import asyncio
import signal
import websockets
import http
import json
import logging
import logging.config
import ssl
import struct

from typing import Set
from websockets.server import Request
from zero_hid import Device, Mouse, Keyboard, KeyCodes, Consumer, ConsumerCodes

logging.config.fileConfig('logging.conf')
logger = logging.getLogger(__name__)

# Clients IPs whitelist
AUTHORIZED_IPS: Set[str] = set(ip.strip() for ip in "<websocket_authorized_clients_ips>".split(","))


# Server config
SERVER_HOST = "0.0.0.0"
SERVER_PORT = <websocket_server_port>
SERVER_SECRET = "<websocket_server_secret>"

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

async def process_request(connection, request: Request):
    # Get client IP from transport
    remote = connection.remote_address  # a tuple (host, port)
    if remote:
        client_ip = remote[0] if remote else "unknown"
        logger.info(f"Handshake from IP: {client_ip}")
    else:
        logger.warning("Could not determine client IP")
        return http.HTTPStatus.FORBIDDEN, [], b"Forbidden: unknown IP"

    # IP check
    if client_ip not in AUTHORIZED_IPS:
        logger.warning(f"Rejected IP: {client_ip}")
        return http.HTTPStatus.FORBIDDEN, [], b"Forbidden: IP not allowed"

    # Read headers
    secret = request.headers["X-Secret"]

    if not secret:
        logger.warning("Missing X-Secret header")
        return http.HTTPStatus.UNAUTHORIZED, [], b"Unauthorized: missing secret"

    # Secret check
    if secret != SERVER_SECRET:
        logger.warning(f"Rejected secret: {secret}")
        return http.HTTPStatus.UNAUTHORIZED, [], b"Unauthorized: secret does not match"

    logger.info(f"Authorized: IP={client_ip}")
    return None  # Allow handshake

async def handle_client(websocket) -> None:

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
                keyboard_state["keys"] = keys
                for k in keys:
                    if k == KeyCodes["KEY_NUMLOCK"]:
                        keyboard_state["numlock"] = not keyboard_state["numlock"]
                    elif k == KeyCodes["KEY_CAPSLOCK"]:
                        keyboard_state["capslock"] = not keyboard_state["capslock"]
                    elif k == KeyCodes["KEY_SCROLLLOCK"]:
                        keyboard_state["scrolllock"] = not keyboard_state["scrolllock"]

            elif cmd == 0x40 and len(message) >= 2:  # conpress
                count = message[1]
                expected_length = 2 + count * 2  # 2 header bytes + 2 bytes per item
                if len(message) < expected_length:
                    logger.warning("Malformed conpress command length: expected %d, got %d", expected_length, len(message))
                    return

                cons = list(struct.unpack(f"<{count}H", message[2:2 + count * 2]))
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

            elif cmd == 0x60 :  # audio:start
                logger.debug("Audio start requested")

            elif cmd in (0x61, 0x62, 0x63):  # audio:transfert
                if cmd == 0x61 and len(message) >= 2:  # small buffer (from 0 to 255)
                    length = message[1] # 1 byte
                    buffer = message[2:2 + length]
                    logger.debug("Audio buffer (small): %s", length)
                elif cmd == 0x62 and len(message) >= 3:  # medium buffer (from 256 to 65535)
                    length = struct.unpack_from("<H", message, 1)[0] # 2 bytes
                    buffer = message[3:3 + length]
                    logger.debug("Audio buffer (medium): %s", length)
                elif cmd == 0x63 and len(message) >= 5:  # large buffer (from 65536 to 4294967295)
                    length = struct.unpack_from("<I", message, 1)[0] # 4 bytes
                    buffer = message[5:5 + length]
                    logger.debug("Audio buffer (large): %s", length)

            elif cmd == 0x70 :  # audio:stop
                logger.debug("Audio stop requested")

            else:
                logger.warning("Unknown or malformed command: 0x%02X", cmd)

    except websockets.ConnectionClosed:
        logger.info("Client disconnected")

async def main():
    stop_event = asyncio.Event()

    async def shutdown():
        logger.info("Shutting down WebSocket server...")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(shutdown()))

    # Start the WebSocket server
    server = await websockets.serve(
        handle_client,
        SERVER_HOST,
        SERVER_PORT,
        ssl=ssl_context,
        process_request=process_request,
    )
    logger.info(f"WebSocket server started at wss://{SERVER_HOST}:{SERVER_PORT}")

    await stop_event.wait() # Wait forever until interrupted
    server.close() # Close server whenever interrupted
    await server.wait_closed()  # Wait forever until server closed

    logger.info(f"WebSocket server stopped at wss://{SERVER_HOST}:{SERVER_PORT}")

if __name__ == "__main__":
    asyncio.run(main())
