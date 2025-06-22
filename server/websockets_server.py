import asyncio
import websockets
import ast
import json
import logging
import logging.config
logging.config.fileConfig('logging.conf')
logger = logging.getLogger(__name__)

from zero_hid import Device
from zero_hid import Mouse
from zero_hid import Keyboard, KeyCodes
from zero_hid import Consumer, ConsumerCodes

hid = Device()
mouse = Mouse(hid)
keyboard = Keyboard(hid, "FR")
keyboard_state = {
    "modifiers": [],
    "keys": [],
    "numlock": False,
    "capslock": False,
    "scrolllock": False,
}
key_codes_map = KeyCodes.as_dict()
consumer = Consumer(hid)
consumer_codes_map = ConsumerCodes.as_dict()

def safe_eval(s):
    try:
        return ast.literal_eval(s)
    except (ValueError, SyntaxError):
        logger.warning(
            "Ignored value %s: error occurred while trying to convert it as list. ValueError: '%s'; SyntaxError: '%s';", 
            s, ValueError, SyntaxError)
        return []

async def handle_client(websocket):
    logger.info("Client connected")
    try:
        async for message in websocket:
            logger.debug("Received: '%s'", message)

            if logger.getEffectiveLevel() == logging.DEBUG:
                bytes = message.encode('utf-8')
                bytesStr = " ".join(["0x%02x" % byte for byte in bytes])
                logger.debug("Hex representation: '%s'", bytesStr)

            if message.startswith("move:"):
                dx, dy = map(int, message.replace("move:", "").split(","))
                logger.debug("Mouse move in progress: %s %s", dx, dy)
                mouse.move(dx, dy)
                logger.debug("Mouse move end: %s %s", dx, dy)

            elif message.startswith("scroll:"):
                dx, dy = map(int, message.replace("scroll:", "").split(","))
                logger.debug("Mouse scroll in progress: %s %s", dx, dy)
                if dx != 0:
                  mouse.scroll_x(dx)
                if dy != 0:
                  mouse.scroll_y(dy)
                logger.debug("Mouse scroll end: %s %s", dx, dy)

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
                    logger.warning("Unable to find modifiers: '%s'", unknown_modifiers)

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
                    logger.warning("Unable to find keys: '%s'", unknown_keys)

                if not unknown_modifiers and not unknown_keys:
                    # All modifiers and keys are known

                    # Press the keyboard 0..N modifiers and/or 0..1 key (0 means no key)
                    keyboard.press(modifierCodes, keyCodes, release=False)

                    # Update keyboard states for later synchronization calls
                    keyboard_state["modifiers"] = modifiers
                    keyboard_state["keys"] = [keys[0]] if keys else []
                    for keyCode in keyCodes:
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
                    logger.warning("Unable to find consumers: '%s'", unknown_consumers)

                if not unknown_consumers:
                    # All consumers keys are known
                    consumer.press(consumerCodes, release=False)

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
                logger.debug("sync:keyboard: response_data='%s'", response_data)

    except websockets.ConnectionClosed:
        logger.info("Client disconnected")

async def main():
    # Start websockets server infinite loop
    async with websockets.serve(handle_client, "0.0.0.0", 8765):
        logger.info("WebSocket server running at ws://0.0.0.0:8765")
        await asyncio.Future()  # Run forever

asyncio.run(main())
