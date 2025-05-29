import asyncio
import sys
import websockets
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ws-client")

WS_URI = "ws://<websocket_server_ip>:8765"
RECONNECT_DELAY = 5

class WSClient:
    def __init__(self, uri):
        self.uri = uri
        self.websocket = None
        self.connected = asyncio.Event()

    async def connect_loop(self):
        """Persistent connection loop with reconnection."""
        while True:
            try:
                logger.info(f"Connecting to {self.uri}...")
                self.websocket = await websockets.connect(self.uri)
                self.connected.set()
                logger.info("Connected to WebSocket")
                await self.websocket.wait_closed()
                logger.warning("WebSocket closed")
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
            self.connected.clear()
            await asyncio.sleep(RECONNECT_DELAY)

    async def send_move(self, x, y):
        await self.connected.wait()
        try:
            msg = f"move:{x},{y}"
            logger.debug(f"Sending: {msg}")
            await self.websocket.send(msg)
            logger.info(f"Sent: {msg}")
        except Exception as e:
            logger.error(f"Send failed: {e}")

async def stdin_listener(client: WSClient):
    """Read stdin lines and forward to WebSocket."""
    loop = asyncio.get_event_loop()
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await loop.connect_read_pipe(lambda: protocol, sys.stdin)

    while True:
        line = await reader.readline()
        if not line:
            break
        try:
            x_str, y_str = line.decode().strip().split(",")
            await client.send_move(int(x_str), int(y_str))
        except Exception as e:
            logger.warning(f"Invalid input '{line.decode().strip()}': {e}")

async def main():
    client = WSClient(WS_URI)
    await asyncio.gather(
        client.connect_loop(),
        stdin_listener(client)
    )

if __name__ == "__main__":
    asyncio.run(main())
