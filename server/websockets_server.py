import asyncio
import websockets
import json
import logging
import logging.config
import ssl
import struct
logging.config.fileConfig('logging.conf')
logger = logging.getLogger(__name__)

from zero_hid import Device
from zero_hid import Mouse
from zero_hid import Keyboard, KeyCodes
from zero_hid import Consumer, ConsumerCodes

# SSL Context
ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ssl_context.load_cert_chain(certfile="server.crt", keyfile="server.key")

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

async def handle_client(websocket: WebSocketServerProtocol) -> None:
    logger.info("Client connected")
    try:
        async for message in websocket:
            if isinstance(message, str):
                logger.warning("Expected binary message, received text.")
                continue

            cmd = message[0]
            if logger.getEffectiveLevel() == logging.DEBUG:
                logger.debug("Received binary command: 0x%02X", cmd)
                logger.debug("Raw bytes: %s", " ".join(f"0x{b:02X}" for b in message))

            if cmd == 0x01 and len(message) == 3:  # scroll
                _, x, y = struct.unpack("<Bbb", message)
                logger.debug("Scroll: x=%d, y=%d", x, y)
                if x:
                    mouse.scroll_x(x)
                if y:
                    mouse.scroll_y(y)

            elif cmd == 0x02 and len(message) == 3:  # move
                _, x, y = struct.unpack("<Bbb", message)
                logger.debug("Move: x=%d, y=%d", x, y)
                mouse.move(x, y)

            elif cmd in (0x10, 0x11, 0x12):  # clicks
                if cmd == 0x10:
                    logger.debug("Click left")
                    mouse.left_click(release=False)
                elif cmd == 0x11:
                    logger.debug("Click middle")
                    mouse.middle_click(release=False)
                elif cmd == 0x12:
                    logger.debug("Click right")
                    mouse.right_click(release=False)

            elif cmd == 0x13:
                logger.debug("Click release")
                mouse.release()

            elif cmd == 0x20 and len(message) >= 2:  # chartap
                length = message[1]
                chars = message[2:2 + length].decode('utf-8', errors='ignore')
                logger.debug("Chartap: %s", chars)
                keyboard.type(chars)

            elif cmd == 0x30 and len(message) >= 3:  # keypress
                mod_count = message[1]
                mods = list(message[2:2 + mod_count])
                key_count_index = 2 + mod_count
                key_count = message[key_count_index]
                keys = list(message[key_count_index + 1:key_count_index + 1 + key_count])

                logger.debug("Keypress: modifiers=%s keys=%s", mods, keys)

                # Directly use raw codes
                keyboard.press(mods, keys, release=False)

                # Update keyboard state
                keyboard_state["modifiers"] = mods
                keyboard_state["keys"] = keys[:1] if keys else []
                for k in keys:
                    if k == KeyCodes["KEY_NUMLOCK"]:
                        keyboard_state["numlock"] = not keyboard_state["numlock"]
                    elif k == KeyCodes["KEY_CAPSLOCK"]:
                        keyboard_state["capslock"] = not keyboard_state["capslock"]
                    elif k == KeyCodes["KEY_SCROLLLOCK"]:
                        keyboard_state["scrolllock"] = not keyboard_state["scrolllock"]

            elif cmd == 0x40 and len(message) >= 2:  # conpress
                count = message[1]
                cons = list(message[2:2 + count])
                logger.debug("Conpress: %s", cons)
                consumer.press(cons, release=False)

            elif cmd == 0x50:  # sync:keyboard
                logger.debug("Sync keyboard requested")
                response_data = {
                    "modifiers": keyboard_state["modifiers"],
                    "keys": keyboard_state["keys"],
                    "numlock": keyboard_state["numlock"],
                    "capslock": keyboard_state["capslock"],
                    "scrolllock": keyboard_state["scrolllock"],
                }
                await websocket.send(json.dumps(response_data).encode('utf-8'))
                logger.debug("Sync response: %s", response_data)

            else:
                logger.warning("Unknown or malformed command: 0x%02X", cmd)

    except websockets.ConnectionClosed:
        logger.info("Client disconnected")

async def main():
    # Start websockets server infinite loop
    async with websockets.serve(handle_client, "0.0.0.0", 8765, ssl=ssl_context):
        logger.info("WebSocket server running at wss://0.0.0.0:8765")
        await asyncio.Future()  # Run forever

asyncio.run(main())
