import asyncio
import websockets

class WebSocketClient:
    def __init__(self, uri):
        self.uri = uri
        self.websocket = None

    async def send_move(self, x, y):
        if self.websocket is None:
            self.websocket = await websockets.connect(self.uri)
        await self.websocket.send(f"move:{x},{y}")
