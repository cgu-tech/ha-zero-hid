import asyncio
import json
import logging
import websockets

_LOGGER = logging.getLogger(__name__)

class WebSocketClient:
    def __init__(self, url):
        self.url = url
        self.websocket = None
        self._lock = asyncio.Lock()  # Prevent race conditions

    async def send_scroll(self, x, y):
        await self.send(f"scroll:{x},{y}")

    async def send_move(self, x, y):
        await self.send(f"move:{x},{y}")

    async def send_clickleft(self):
        await self.send("click:left")

    async def send_clickmiddle(self):
        await self.send("click:middle")

    async def send_clickright(self):
        await self.send("click:right")

    async def send_clickrelease(self):
        await self.send("click:release")

    async def send_keypress(self, modifiers, keys):
        await self.send(f"keypress:{modifiers}:{keys}")

    async def sync_keyboard(self) -> dict:
        response = await self.send(f"sync:keyboard", waitResponse=True)
        data = json.loads(response)
        return {
            "modifiers": data.get("modifiers", []),
            "keys": data.get("keys", []),
            "numlock": bool(data.get("numlock", False)),
            "capslock": bool(data.get("capslock", False)),
            "scrolllock": bool(data.get("scrolllock", False)),
        }

    async def send(self, cmd, waitResponse=False):
        """Send a command with safe (re)connection."""
        try:
            if not self.websocket:
                _LOGGER.warning("WebSocket not connected. Reconnecting...")
                await self.connect()

            async with self._lock:
                await self.websocket.send(cmd)
                if waitResponse:
                    response = await self.websocket.recv()
                    return response
        except websockets.exceptions.ConnectionClosedOK as e:
            _LOGGER.warning(f"WebSocket closed cleanly: {e}. Reconnecting...")
            await self.recover_and_retry(cmd)
        except Exception as e:
            _LOGGER.error(f"Unexpected WebSocket error: {e}")
            await self.disconnect()

    async def recover_and_retry(self, cmd):
        """Handle recovery logic and retry sending a command."""
        await self.disconnect()
        await asyncio.sleep(1)  # Optional backoff
        await self.connect()
        async with self._lock:
            if self.websocket and not self.websocket.closed:
                try:
                    await self.websocket.send(cmd)
                    _LOGGER.info("Retried move command successfully.")
                except Exception as e:
                    _LOGGER.error(f"Retry failed: {e}")

    async def connect(self):
        """Establish a new WebSocket connection safely."""
        async with self._lock:
            if self.websocket and not self.websocket.closed:
                _LOGGER.debug("WebSocket already connected.")
                return

            try:
                self.websocket = await websockets.connect(self.url)
                _LOGGER.info("WebSocket connection established.")
            except Exception as e:
                _LOGGER.error(f"Failed to connect to WebSocket: {e}")
                self.websocket = None

    async def disconnect(self):
        """Cleanly close WebSocket connection."""
        async with self._lock:
            if self.websocket:
                try:
                    await self.websocket.close()
                    _LOGGER.info("WebSocket connection closed.")
                except Exception as e:
                    _LOGGER.warning(f"Error while closing WebSocket: {e}")
                finally:
                    self.websocket = None
