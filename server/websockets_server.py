import asyncio
import websockets
import ast
import json
import logging
import logging.config

from zero_hid import Mouse
from zero_hid import Keyboard, KeyCodes
from zero_hid import Consumer, ConsumerCodes

logging.config.fileConfig('logging.conf')

mouse = Mouse()
keyboard = Keyboard()
keyboard.set_layout("FR")
keyboard_state = {
    "modifiers": [],
    "keys": [],
    "numlock": False,
    "capslock": False,
    "scrolllock": False,
}
key_codes_map = KeyCodes.as_dict()
consumer = Consumer()
consumer_codes_map = ConsumerCodes.as_dict()

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

                # Separate known modifiers and unknown codes
                modifierCodes = []
                unknown_modifiers = []
                for mod in modifiers:
                    code = key_codes_map.get(mod)
                    if code is not None:
                        modifierCodes.append(code)
                    else:
                        unknown_modifiers.append(mod)
                if unknown_modifiers:
                    print(f"Unable to find modifiers: {unknown_modifiers}")

                # Separate known keycodes, consumer codes and unknown codes
                keyCodes = []
                unknown_keys = []
                for key in keys:
                    code = key_codes_map.get(key)
                    if code is not None:
                        keyCodes.append(code)
                    else:
                        unknown_keys.append(key)
                if unknown_keys:
                    print(f"Unable to find keys: {unknown_keys}")

                if not unknown_modifiers and not unknown_keys:
                    # All modifiers and keys are known

                    # Only one key can be pressed at any time
                    keyCode = keyCodes[0] if keyCodes else 0

                    # Press the keyboard 0..N modifiers and/or 0..1 key (0 means no key)
                    keyboard.press(modifierCodes, keyCode, release=False)

                    # Update keyboard states for later synchronization calls
                    keyboard_state["modifiers"] = modifiers
                    keyboard_state["keys"] = [keys[0]] if keys else []
                    if keyCode == KeyCodes["KEY_NUMLOCK"]:
                        keyboard_state["numlock"] = not keyboard_state["numlock"]
                    elif keyCode == KeyCodes["KEY_CAPSLOCK"]:
                        keyboard_state["capslock"] = not keyboard_state["capslock"]
                    elif keyCode == KeyCodes["KEY_SCROLLLOCK"]:
                        keyboard_state["scrolllock"] = not keyboard_state["scrolllock"]

            elif message.startswith("chartap:"):
                chars = message.replace("chartap:", "")

                # Press the keyboard 0..N modifiers and/or 0..1 key (0 means no key)
                keyboard.type(chars)

            elif message.startswith("conpress:"):
                consumers = safe_eval(message.replace("conpress:", ""))

                # Separate known keycodes, consumer codes and unknown codes
                consumerCodes = []
                unknown_consumers = []
                for con in consumers:
                    code = consumer_codes_map.get(con)
                    if code is not None:
                        consumerCodes.append(code)
                    else:
                        unknown_consumers.append(con)
                if unknown_consumers:
                    print(f"Unable to find keys or consumers: {unknown_consumers}")

                if not unknown_consumers:
                    # All consumers keys are known

                    # Only one consumer can be pressed at any time
                    consumerCode = consumerCodes[0] if consumerCodes else 0
                    consumer.press(consumerCode, release=False)

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
    # Start websockets server infinite loop
    async with websockets.serve(handle_client, "0.0.0.0", 8765):
        print("WebSocket server running at ws://0.0.0.0:8765")
        await asyncio.Future()  # Run forever

asyncio.run(main())
