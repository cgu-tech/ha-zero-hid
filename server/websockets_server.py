import asyncio
import websockets
from zero_hid import Mouse

# Prerequisites
# sudo apt-get install -y git python3-pip python3-venv
# cd ~ && git clone https://github.com/cgu-tech/zero-hid.git
# venv creation : python3 -m venv ~/venv_websocket
# venv activation : source ~/venv_websocket/bin/activate
# packages installations :
#  pip install --editable ~/zero-hid
#  pip install websockets


# Execution
# python3 ~/websocket_server.py

mouse = Mouse()

async def handle_client(websocket):
    print("Client connected")
    try:
        async for message in websocket:
            print("Received:", message)
            b = message.encode('utf-8')
            hex_string = ' '.join(f'{byte:02x}' for byte in b)
            print(f"Hex representation: {hex_string}")

            if message.startswith("scroll:"):
                dx, dy = map(int, message.replace("scroll:", "").split(","))
                print("Mouse scroll in progress:", dx, dy)
                if dx != 0:
                  mouse.scroll_x(dx)
                if dy != 0:
                  mouse.scroll_y(dy)
                print("Mouse scroll end:", dx, dy)

            if message.startswith("move:"):
                dx, dy = map(int, message.replace("move:", "").split(","))
                print("Mouse move in progress:", dx, dy)
                mouse.move(dx, dy)
                print("Mouse move end:", dx, dy)

            elif message == "click:left":
                mouse.left_click(release=False)

            elif message == "click:right":
                mouse.right_click(release=False)

            elif message == "click:middle":
                mouse.middle_click(release=False)

            elif message == "click:release":
                mouse.release()

    except websockets.ConnectionClosed:
        print("Client disconnected")

async def main():
    async with websockets.serve(handle_client, "0.0.0.0", 8765):
        print("WebSocket server running at ws://0.0.0.0:8765")
        await asyncio.Future()  # Run forever

asyncio.run(main())
