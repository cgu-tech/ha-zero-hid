import asyncio
import websockets
import ast
import json

from zero_hid import Mouse
from zero_hid import Keyboard, KeyCodes

mouse = Mouse()
keyboard = Keyboard()
keyboard_state = {
    "modifiers": [],
    "keys": [],
    "numlock": False,
    "capslock": False,
    "scrolllock": False,
}

def safe_eval(s):
    try:
        return ast.literal_eval(s)
    except (ValueError, SyntaxError):
        print(f"Ignored value {s}: error occurred while trying to convert it as list. ValueError: {ValueError}; ValueError: {SyntaxError};")
        return []

async def handle_client(websocket):
    print("Client connected")
    try:
        async for message in websocket:
            print("Received:", message)
            b = message.encode('utf-8')
            hex_string = ' '.join(f'{byte:02x}' for byte in b)
            print(f"Hex representation: {hex_string}")

            if message.startswith("move:"):
                dx, dy = map(int, message.replace("move:", "").split(","))
                print("Mouse move in progress:", dx, dy)
                mouse.move(dx, dy)
                print("Mouse move end:", dx, dy)

            elif message.startswith("scroll:"):
                dx, dy = map(int, message.replace("scroll:", "").split(","))
                print("Mouse scroll in progress:", dx, dy)
                if dx != 0:
                  mouse.scroll_x(dx)
                if dy != 0:
                  mouse.scroll_y(dy)
                print("Mouse scroll end:", dx, dy)

            elif message == "click:left":
                mouse.left_click(release=False)

            elif message == "click:right":
                mouse.right_click(release=False)

            elif message == "click:middle":
                mouse.middle_click(release=False)

            elif message == "click:release":
                mouse.release()

            elif message.startswith("keypress:"):
                modifiers, keys = map(safe_eval, message.replace("keypress:", "").split(":"))
                modifierCodes = [KeyCodes[modifier] for modifier in modifiers]
                keyCodes = [KeyCodes[key] for key in keys]
                keyCode = keyCodes[0] if keyCodes else 0
                keyboard.press(modifierCodes, keyCode, release=False)
                # Update sync states
                keyboard_state["modifiers"] = modifiers
                keyboard_state["keys"] = [keys[0]] if keys else []
                if keyCode == KeyCodes["KEY_NUMLOCK"]:
                    keyboard_state["numlock"] = not keyboard_state["numlock"]
                elif keyCode == KeyCodes["KEY_CAPSLOCK"]:
                    keyboard_state["capslock"] = not keyboard_state["capslock"]
                elif keyCode == KeyCodes["KEY_SCROLLLOCK"]:
                    keyboard_state["scrolllock"] = not keyboard_state["scrolllock"]

            elif message == "sync:keyboard":
                # Send sync state
                response_data = {
                    "modifiers": keyboard_state["modifiers"],
                    "keys": keyboard_state["keys"],
                    "numlock": keyboard_state["numlock"],
                    "capslock": keyboard_state["capslock"],
                    "scrolllock": keyboard_state["scrolllock"],
                }
                response_str = json.dumps(response_data)
                await websocket.send(response_str)
                print(f"sync:keyboard: response_data={response_data}")

    except websockets.ConnectionClosed:
        print("Client disconnected")

async def main():
    # Retrieve initial state
    #try:
    #    print("Forcing keyboard wakeup to prevent infinite blocking while reading led status.")
    #    keyboard.press([], KeyCodes["KEY_CAPSLOCK"], release=True)
    #    keyboard.press([], KeyCodes["KEY_CAPSLOCK"], release=True)
    #
    #    print("Reading initial LEDs status.")
    #    leds = keyboard.blocking_read_led_status
    #    keyboard_state["numlock"] = leds.get("num_lock", False)
    #    keyboard_state["capslock"] = leds.get("caps_lock", False)
    #    keyboard_state["scrolllock"] = leds.get("scroll_lock", False)
    #except asyncio.TimeoutError:
    #    print("Timeout: LED status read took too long.")
    #    return
    #except Exception as e:
    #    print(f"Error reading LED status: {e}")
    #    return
    # Start websockets server infinite loop
    async with websockets.serve(handle_client, "0.0.0.0", 8765):
        print("WebSocket server running at ws://0.0.0.0:8765")
        await asyncio.Future()  # Run forever

asyncio.run(main())
