import asyncio
import websockets
import logging

_LOGGER = logging.getLogger(__name__)

class WebSocketClient:
    def __init__(self, url):
        self.url = url
        self.websocket = None
        self._lock = asyncio.Lock()  # Prevent race conditions

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

    async def send_move(self, x, y):
        """Send a move command with safe (re)connection."""
        try:
            if not self.websocket:
                _LOGGER.warning("WebSocket not connected. Reconnecting...")
                await self.connect()

            await self.websocket.send(f"move:{x},{y}")
        except websockets.exceptions.ConnectionClosedOK as e:
            _LOGGER.warning(f"WebSocket closed cleanly: {e}. Reconnecting...")
            await self.recover_and_retry(x, y)
        except Exception as e:
            _LOGGER.error(f"Unexpected WebSocket error: {e}")
            await self.disconnect()

    async def recover_and_retry(self, x, y):
        """Handle recovery logic and retry sending."""
        await self.disconnect()
        await asyncio.sleep(1)  # Optional backoff
        await self.connect()
        async with self._lock:
            if self.websocket and not self.websocket.closed:
                try:
                    await self.websocket.send(f"move:{x},{y}")
                    _LOGGER.info("Retried move command successfully.")
                except Exception as e:
                    _LOGGER.error(f"Retry failed: {e}")
