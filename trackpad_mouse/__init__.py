from __future__ import annotations

import logging

from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .websocket_handler import WebSocketClient

DOMAIN = "trackpad_mouse"
_LOGGER = logging.getLogger(__name__)

# Use empty_config_schema because the component does not have any config options
CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)

async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the websocket global client."""
    ws_client = WebSocketClient("ws://<websocket_server_ip>:8765")
    await ws_client.connect()

    """Set up the async handle_move service component."""
    @callback
    async def handle_move(call: ServiceCall) -> None:
        x = call.data.get("x")
        y = call.data.get("y")
        await ws_client.send_move(x, y)

    # Register our service with Home Assistant.
    hass.services.async_register(DOMAIN, "move", handle_move)

    # Return boolean to indicate that initialization was successfully.
    return True
