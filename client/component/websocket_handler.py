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
            try:
                if not self.websocket:
                    _LOGGER.warning("WebSocket not connected. Reconnecting...")
                    await self.connect()

                await self.websocket.send(cmd)
                if wait_response:
                    response = await self.websocket.recv()
                    return response
            except ConnectionClosedOK as e:
                _LOGGER.warning(f"WebSocket closed cleanly: {e}. Reconnecting...")
                await self.recover_and_retry(cmd)
            except Exception as e:
                _LOGGER.error(f"Unexpected WebSocket error: {e}")
                await self.disconnect()

    async def recover_and_retry(self, cmd: bytes) -> None:
        """Handle recovery logic and retry sending a command."""
        await self.disconnect()
        await asyncio.sleep(1)  # Optional backoff
        await self.connect()
        if self.websocket and not self.websocket.closed:
            try:
                await self.websocket.send(cmd)
                _LOGGER.info("Retried command successfully.")
            except Exception as e:
                _LOGGER.error(f"Retry failed: {e}")

    async def connect(self) -> None:
        """Establish a new WebSocket connection safely."""
        if self.websocket and not self.websocket.closed:
            _LOGGER.debug("WebSocket already connected.")
            return

        try:
            ssl_context = client_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE  # Accept self-signed certs (insecure but OK for testing)

            # Authentication headers
            extra_headers = {
                "X-Secret": self.secret,
            }

            # Try to connect to remote websockets server
            self.websocket = await websockets.connect(self.url, ssl=ssl_context, extra_headers=extra_headers)
            _LOGGER.info("WebSocket connection established.")
        except Exception as e:
            _LOGGER.error(f"Failed to connect to WebSocket: {e}")
            self.websocket = None

    async def disconnect(self) -> None:
        """Cleanly close WebSocket connection."""
        if self.websocket:
            try:
                await self.websocket.close()
                _LOGGER.info("WebSocket connection closed.")
            except Exception as e:
                _LOGGER.warning(f"Error while closing WebSocket: {e}")
            finally:
                self.websocket = None
