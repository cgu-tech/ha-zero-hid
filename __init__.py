from .websocket_handler import WebSocketClient

async def async_setup(hass, config):
    ws_client = WebSocketClient("ws://<websocket_server_ip>:8765")
    await ws_client.connect()

    async def handle_move(call):
        x = call.data.get("x")
        y = call.data.get("y")
        await ws_client.send_move(x, y)

    hass.services.async_register("trackpad_mouse", "move", handle_move)
    return True
