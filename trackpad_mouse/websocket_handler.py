import asyncio
import websockets

class WebSocketClient:
    def __init__(self, uri):
        self.uri = uri
        self.websocket = None

    async def connect(self):
        self.websocket = await websockets.connect(self.uri)

    def is_connected(self):
        return self.websocket is not None and not self.websocket.closed

    async def send_move(self, x, y):
        if self.websocket is None or self.websocket.closed:
            raise RuntimeError("WebSocket is not connected")
        await self.websocket.send(f"move:{x},{y}")
