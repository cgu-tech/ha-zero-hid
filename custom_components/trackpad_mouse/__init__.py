from __future__ import annotations

import logging
import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .websocket_handler import WebSocketClient
from .const import DOMAIN, MIN_RANGE, MAX_RANGE

_LOGGER = logging.getLogger(__name__)

# Use empty_config_schema because the component does not have any config options
CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)

def clamp_to_range(value, min_val, max_val):
    try:
        value = int(float(value))  # Accept strings or floats, convert to int
    except (ValueError, TypeError):
        value = 0  # Or set to None, or raise, depending on what you want
    return max(min_val, min(max_val, value))

MOVE_SERVICE_SCHEMA = vol.Schema({
    vol.Required("x"): lambda v: clamp_to_range(v, MIN_RANGE, MAX_RANGE),
    vol.Required("y"): lambda v: clamp_to_range(v, MIN_RANGE, MAX_RANGE),
})

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
    hass.services.async_register(DOMAIN, "move", handle_move, schema=MOVE_SERVICE_SCHEMA)

    # Return boolean to indicate that initialization was successfully.
    return True
