import asyncio
import json
import logging
import ssl
import struct
import websockets

from homeassistant.util.ssl import client_context
from websockets.exceptions import ConnectionClosedOK, ConnectionClosedError

_LOGGER = logging.getLogger(__name__)

class WebSocketClient:
    def __init__(self, url: str, secret: str):
        self.url = url
        self.websocket = None
        self.secret = secret
        self._lock = asyncio.Lock()  # Prevent race conditions

    # Send scroll as 2 signed bytes: [0x01][x][y]
    async def send_scroll(self, x: int, y: int) -> None:
        cmd = struct.pack("<Bbb", 0x01, x, y)
        await self.send(cmd)

    # Send move as 2 signed bytes: [0x02][x][y]
    async def send_move(self, x: int, y: int) -> None:
        cmd = struct.pack("<Bbb", 0x02, x, y)
        await self.send(cmd)

    # Mouse clicks: [0x10 + button_id]
    async def send_clickleft(self) -> None:
        await self.send(b'\x10')

    async def send_clickmiddle(self) -> None:
        await self.send(b'\x11')

    async def send_clickright(self) -> None:
        await self.send(b'\x12')

    async def send_clickrelease(self) -> None:
        await self.send(b'\x13')

    # Chartap (send characters as UTF-8): [0x20][len][...chars...]
    async def send_chartap(self, chars: str) -> None:
        encoded = chars.encode("utf-8")
        cmd = struct.pack("<BB", 0x20, len(encoded)) + encoded
        await self.send(cmd)

    # Keypress with modifiers: [0x30][mod_count][mod1, mod2, ...][key_count][key1, key2, ...]
    async def send_keypress(self, modifiers: list[int], keys: list[int]) -> None:
        cmd = struct.pack("<B", 0x30)
        cmd += struct.pack("<B", len(modifiers)) + bytes(modifiers)
        cmd += struct.pack("<B", len(keys)) + bytes(keys)
        await self.send(cmd)

    # Consumer press: [0x40][count][con1_lo][con1_hi][con2_lo][con2_hi]...
    async def send_conpress(self, cons: list[int]) -> None:
        count = len(cons)
        cons_bytes = b''.join(c.to_bytes(2, byteorder='little', signed=False) for c in cons)
        cmd = struct.pack("<BB", 0x40, count) + cons_bytes
        await self.send(cmd)

    # Sync keyboard request: [0x50], expects json response
    async def sync_keyboard(self) -> dict:
        response = await self.send(b'\x50', wait_response=True)

        data: dict = {}
        if response is None:
            _LOGGER.warning(f"Cannot sync keyboard")
        else:
            data = json.loads(response)

        return {
            "modifiers": data.get("modifiers", []),
            "keys": data.get("keys", []),
            "numlock": bool(data.get("numlock", False)),
            "capslock": bool(data.get("capslock", False)),
            "scrolllock": bool(data.get("scrolllock", False)),
        }

    # Audio start: [0x60]
    async def send_audiostart(self) -> None:
        await self.send(b'\x60')

    # Audio transfert (send audio buffer optimized by size): [0x61|62|63][len][...bytes...]
    async def send_audio(self, buffer: list[int]) -> None:
        bufLen = len(buffer)
        if bufLen < 256:
            cmd = struct.pack("<BB", 0x61, bufLen)
        elif bufLen < 65536:
            cmd = struct.pack("<BH", 0x62, bufLen)
        else:
            cmd = struct.pack("<BI", 0x63, bufLen)
        cmd += bytes(buffer)
        await self.send(cmd)

    # Audio stop: [0x70]
    async def send_audiostop(self) -> None:
        await self.send(b'\x70')

    async def send(self, cmd: bytes, wait_response: bool = False) -> bytes | None:
        """Send a command with safe (re)connection."""
        async with self._lock:
            return await self._unsafe_send(cmd, wait_response)

    async def _unsafe_send(self, cmd: bytes, wait_response: bool = False, retries: int = 1) -> bytes | None:
        """Try to establish websocket connection first then send message."""
        try:
            # Try to open websocket connection
            await self.connect()

            # Websocket connection failed: fail safe
            if not self.is_connected():
                _LOGGER.error("WebSocket reconnect failed")
                return None

            # Websocket connection succeed: send message and wait for response (if/when needed)
            await self.websocket.send(cmd)
            if wait_response:
                return await self.websocket.recv()

            _LOGGER.debug("Message sent")
            return None

        except (ConnectionClosedOK, ConnectionClosedError) as wsCloseEx:
            if retries > 0:
                _LOGGER.warning(f"WebSocket closed: {wsCloseEx}. {retries} {'retry' if retries == 1 else 'retries'} remaining...")
                await self.disconnect()
                return await self._unsafe_send(cmd, wait_response, retries - 1)
            else:
                _LOGGER.warning(f"WebSocket closed: {wsCloseEx}. No retry remaining: aborting...")
                await self.disconnect()

        except Exception as ex:
            _LOGGER.error(f"Unexpected send error: {ex}")
            await self.disconnect()

        _LOGGER.warning("Message not sent")
        return None

    async def connect(self) -> None:
        """Establish a new WebSocket connection safely."""
        if self.is_connected():
            _LOGGER.debug("WebSocket already connected")
            return

        try:
            _LOGGER.info("WebSocket connection in progress...")
            ssl_context = client_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE  # Accept self-signed certs (insecure but OK for testing)

            # Authentication headers
            extra_headers = {
                "X-Secret": self.secret,
            }

            # Try to connect to remote websockets server
            try:
                # HA 2026+ websockets >= 10
                self.websocket = await websockets.connect(self.url, ssl=ssl_context, additional_headers=extra_headers)
            except TypeError:
                # HA 2025+ websockets < 9
                self.websocket = await websockets.connect(self.url, ssl=ssl_context, extra_headers=extra_headers)

            _LOGGER.info("WebSocket connection established")
        except Exception as ex:
            await self.disconnect()
            raise RuntimeError(f"WebSocket connection failed: {ex}")

    async def disconnect(self) -> None:
        """ Tries to close WebSocket connection"""
        if self.websocket:
            try:
                await self.websocket.close()
            except Exception as ex:
                _LOGGER.warning(f"Swallowed error while closing websocket connection: {ex}")
            finally:
                self.websocket = None
                _LOGGER.info("WebSocket connection closed")

    def is_connected(self) -> bool:
        try:
            return (
                self.websocket is not None
                and not getattr(self.websocket, "closed", False)
            )
        except Exception:
            return False
