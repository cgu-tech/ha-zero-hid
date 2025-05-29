from __future__ import annotations

import logging

from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .websocket_handler import WebSocketClient
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

# Use empty_config_schema because the component does not have any config options
CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)

async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the websocket global client."""
    ws_client = WebSocketClient("ws://192.168.0.86:8765")
    hass.data[DOMAIN] = ws_client  # store globally

    """Set up the async handle_move service component."""
    @callback
    async def handle_move(call: ServiceCall) -> None:
        x = call.data.get("x")
        y = call.data.get("y")
        _LOGGER.info(f"handle_move.call.data.x: {x}")
        _LOGGER.info(f"handle_move.call.data.y: {y}")

        # Use shared client
        ws_client = hass.data[DOMAIN]
        _LOGGER.info("ws_client retrieved")

        await ws_client.send_move(x, y)
        _LOGGER.info(f"ws_client.send_move(x, y): {x},{y}")

    # Register our service with Home Assistant.
    hass.services.async_register(DOMAIN, "move", handle_move)

    # Return boolean to indicate that initialization was successfully.
    return True
