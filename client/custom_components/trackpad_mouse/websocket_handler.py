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
        """Send a move command."""
        await self.send(f"move:{x},{y}")

    async def send_clickleft(self):
        """Send a mouse left click."""
        await self.send(f"click:left")

    async def send_clickmiddle(self):
        """Send a mouse middle click."""
        await self.send(f"click:middle")

    async def send_clickright(self):
        """Send a mouse right click."""
        await self.send(f"click:right")

    async def send_clickrelease(self):
        """Send a mouse release click."""
        await self.send(f"click:release")

    async def send(self, cmd):
        """Send a command with safe (re)connection."""
        try:
            if not self.websocket:
                _LOGGER.warning("WebSocket not connected. Reconnecting...")
                await self.connect()

            await self.websocket.send(cmd)
        except websockets.exceptions.ConnectionClosedOK as e:
            _LOGGER.warning(f"WebSocket closed cleanly: {e}. Reconnecting...")
            await self.recover_and_retry(x, y)
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
