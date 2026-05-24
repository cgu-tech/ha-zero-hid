import asyncio
import json
import logging
import ssl
import struct
import sys
import websockets

from collections.abc import Awaitable, Callable
from homeassistant.util.ssl import client_context
from typing import Any
from websockets.exceptions import ConnectionClosedOK, ConnectionClosedError

_LOGGER = logging.getLogger(__name__)

ReceiveCallback = Callable[[dict[str, Any]], Awaitable[None]]
MAX_ID = sys.maxsize

class WebSocketClient:
    def __init__(self, url: str, secret: str, on_receive: ReceiveCallback) -> None:
        self.url = url
        self.websocket = None
        self.secret = secret
        self.on_receive = on_receive

        # Enforces:
        # - serialized send ordering
        # - serialized reconnect handling
        # - single active sender state machine
        self._lock = asyncio.Lock()

        # Enforces pending responses mutations
        self._pending_lock = asyncio.Lock()

        self._receive_task: asyncio.Task | None = None
        self._pending_responses: dict[int, asyncio.Future] = {}
        self._current_message_id = 0

    async def send(self, message: bytes, wait_response: bool = False) -> Any:
        async with self._lock:
            # First fail: retry, second fail: raise
            retries = 2
            last_retry = retries - 1
            for retry in range(retries):
                try:
                    if not self.is_connected():
                        await self.connect()
                        await self.start_receive()

                    return await self.unsafe_send(message, wait_response)
                except Exception as ex:
                    _LOGGER.exception("Send failed (%s out of %s)", retry + 1, retries)
                    await self.disconnect()
                    await self.stop_receive()
                    await self.fail_pending_responses(ex)
                    if retry == last_retry:
                        raise

    async def unsafe_send(self, message: bytes, wait_response: bool = False, timeout: int = 5) -> Any:
        message_id: int | None = None
        response_data: Any = None
        try:
            # Prepare message response future handling (when needed)
            pending_response: asyncio.Future | None = None
            message_to_send: bytes = message
            if wait_response:

                # Create unique message ID and payload for response handling
                message_id = self.get_next_message_id()
                message_to_send = self.get_message_with_id(message, message_id)

                # Create async callback for response
                pending_response = asyncio.get_running_loop().create_future()
                async with self._pending_lock:
                    self._pending_responses[message_id] = pending_response

            # Send message for response
            await self.websocket.send(message_to_send)
            _LOGGER.debug("Message sent")

            # Wait for response
            if pending_response:
                response_data = await asyncio.wait_for(pending_response, timeout=timeout)
                _LOGGER.debug("Response received")

        except Exception:
            if message_id:
                async with self._pending_lock:
                    self._pending_responses.pop(message_id, None)
            raise

        return response_data

    async def receive_loop(self) -> None:
        """Permanent websocket receiver."""
        try:
            while True:

                # Parse raw to response
                message_raw = await self.websocket.recv()
                message: dict = {}
                try:
                    message = json.loads(message_raw)
                except Exception:
                    _LOGGER.warning(f"WebSocket received invalid JSON message: {message_raw}")
                    continue

                # Check message type
                message_type = message.get("type", None)

                # Sollicited message (response to a request): trigger response future resolution
                if message_type == "response":
                    message_id = message.get("id", None)
                    pending_response = None
                    async with self._pending_lock:
                        pending_response = self._pending_responses.pop(message_id, None)
                    if pending_response and not pending_response.done():
                        message_data = message.get("data", None)
                        pending_response.set_result(message_data)
                        continue

                # Unsolicited message (external event): trigger receive callback
                try:
                    if self.on_receive:
                        await self.on_receive(message)
                except asyncio.CancelledError:
                    _LOGGER.debug("Receive task cancelled")
                    raise
                except Exception as ex:
                    _LOGGER.exception("Unsolicited message receive callback failed: %s", ex)

        except asyncio.CancelledError:
            _LOGGER.debug("Receive task cancelled")
            raise

        except (ConnectionClosedOK, ConnectionClosedError) as closeEx:
            _LOGGER.warning("WebSocket receive loop closed")
            await self.fail_pending_responses(closeEx)

        except Exception as ex:
            _LOGGER.exception("WebSocket receive loop crashed: %s", ex)
            await self.fail_pending_responses(ex)

    async def fail_pending_responses(self, ex: Exception) -> None:
        async with self._pending_lock:
            for pending_response in self._pending_responses.values():
                try:
                    if not pending_response.done():
                        pending_response.set_exception(ex)
                except Exception as ex:
                    _LOGGER.exception("Unexpected error while failing pending")
            self._pending_responses.clear()

    async def connect(self) -> None:
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

    async def start_receive(self) -> None:
        if self._receive_task is None or self._receive_task.done():
            self._receive_task = asyncio.create_task(self.receive_loop())
        _LOGGER.info("WebSocket receive loop activated")

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

    async def stop_receive(self) -> None:
        if self._receive_task and not self._receive_task.done():
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
        self._receive_task = None
        _LOGGER.info("WebSocket receive loop deactivated")

    def is_connected(self) -> bool:
        try:
            return self.websocket is not None and not getattr(self.websocket, "closed", False)
        except Exception:
            return False

    # =========================================================
    # HID requests
    # =========================================================

    # Send request [0x01]: Mouse scroll
    # Format: [0x01][x][y] whith x,y = signed bytes
    async def send_scroll(self, x: int, y: int) -> None:
        message = struct.pack("<Bbb", 0x01, x, y)
        await self.send(message)

    # Send request [0x02]: Mouse move
    # Format: [0x02][x][y] whith x,y = signed bytes
    async def send_move(self, x: int, y: int) -> None:
        message = struct.pack("<Bbb", 0x02, x, y)
        await self.send(message)

    # Send request [0x10]: Mouse left click
    async def send_clickleft(self) -> None:
        await self.send(b"\x10")

    # Send request [0x11]: Mouse middle click
    async def send_clickmiddle(self) -> None:
        await self.send(b"\x11")

    # Send request [0x12]: Mouse right click
    async def send_clickright(self) -> None:
        await self.send(b"\x12")

    # Send request [0x13]: Mouse click release
    async def send_clickrelease(self) -> None:
        await self.send(b"\x13")

    # Send request [0x20]: Char tap (send characters as UTF-8)
    # Format: [0x20][len][...chars...]
    async def send_chartap(self, chars: str) -> None:
        encoded = chars.encode("utf-8")
        message = struct.pack("<BB", 0x20, len(encoded)) + encoded
        await self.send(message)

    # Send request [0x30]: Key press with modifiers
    # Format: [0x30][mod_count][mod1, mod2, ...][key_count][key1, key2, ...]
    async def send_keypress(self, modifiers: list[int], keys: list[int]) -> None:
        message = struct.pack("<B", 0x30)
        message += struct.pack("<B", len(modifiers)) + bytes(modifiers)
        message += struct.pack("<B", len(keys)) + bytes(keys)
        await self.send(message)

    # Send request [0x40]: Consumer press
    # Format: [0x40][count][con1_lo][con1_hi][con2_lo][con2_hi]...
    async def send_conpress(self, cons: list[int]) -> None:
        count = len(cons)
        cons_bytes = struct.pack(f"<{count}H", *cons)
        message = struct.pack("<BB", 0x40, count) + cons_bytes
        await self.send(message)

    # Send request [0x50]: Sync keyboard, json response expected
    async def sync_keyboard(self) -> dict[str, Any]:
        response = await self.send(b"\x50", wait_response=True)

        data: dict[str, Any] = {} if response is None else response
        return {
            "modifiers": data.get("modifiers", []),
            "keys": data.get("keys", []),
            "numlock": bool(data.get("numlock", False)),
            "capslock": bool(data.get("capslock", False)),
            "scrolllock": bool(data.get("scrolllock", False)),
        }

    # Send request [0x60]: Audio start, no response expected
    async def send_audiostart(self) -> None:
        await self.send(b'\x60')

    # Send request [0x6x]: Audio transfert - send audio buffer optimized by size, no response expected
    # Format: [0x61|0x62|0x63][len][...bytes...]
    async def send_audio(self, buffer: list[int]) -> None:
        bufLen = len(buffer)
        if bufLen < 256:
            message = struct.pack("<BB", 0x61, bufLen)
        elif bufLen < 65536:
            message = struct.pack("<BH", 0x62, bufLen)
        else:
            message = struct.pack("<BI", 0x63, bufLen)
        message += bytes(buffer)
        await self.send(message)

    # Send request [0x70]: Audio stop, no response expected
    async def send_audiostop(self) -> None:
        await self.send(b'\x70')

    # =========================================================
    # Request helpers
    # =========================================================

    # Generate unique request ID
    def get_next_message_id(self) -> int:
        # Prevent overflow
        if self._current_message_id == MAX_INT:
            self._current_message_id = 0

        # Generate next ID
        self._current_message_id += 1
        return self._current_message_id

    # Generate full message with associated id
    # Format: [0xF0][id_len][...id_bytes...][...message_bytes...]
    def get_message_with_id(self, message: bytes, message_id: int) -> bytes:
        id_length = self.get_unsigned_int_c_length(message_id)
        id_format = self.get_unsigned_int_format(id_length)
        header = struct.pack(f"<BB{id_format}", 0xF0, id_length, message_id)
        return header + message

    # Get length of C equivalent unsigned int type for specified python int value (in bytes)
    def get_unsigned_int_c_length(self, value: int) -> int:
        needed = self.get_unsigned_int_py_length(value)
        for width in (1, 2, 4, 8):
            if needed <= width:
                return width
        raise OverflowError(f"Unsupported length {needed} for unsigned int {value}: too large for standard C unsigned integer")

    # Get length used by python vm for specified python int value (in bytes)
    def get_unsigned_int_py_length(self, value: int) -> int:
        if value < 0:
            raise ValueError(f"Unsupported value {value}: only unsigned values supported")
        return max(1, (value.bit_length() + 7) // 8)

    # Get smallest struct string format able to encapsulate python int value for specified length
    def get_unsigned_int_format(self, length: int) -> str:
        if length == 1:
            return "B"
        elif length == 2:
            return "H"
        elif length == 4:
            return "I"
        elif length == 8:
            return "Q"
        else:
            raise ValueError(f"Unsupported length: expected length to be one of [1, 2, 4, 8], got {length}")
