import asyncio
import websockets

class WebSocketClient:
    def __init__(self, uri):
        self.uri = uri
        self.websocket = None

    async def connect(self):
        self.websocket = await websockets.connect(self.uri)

    async def send_move(self, x, y):
        if self.websocket is None:
            await self.connect()
        msg = f"move:{x},{y}"
        await self.websocket.send(msg)
import asyncio
import websockets

class WebSocketClient:
    def __init__(self, uri):
        self.uri = uri
        self.websocket = None

    async def connect(self):
        self.websocket = await websockets.connect(self.uri)

    async def send_move(self, x, y):
        if self.websocket is None:
            await self.connect()
        msg = f"move:{x},{y}"
        await self.websocket.send(msg)
