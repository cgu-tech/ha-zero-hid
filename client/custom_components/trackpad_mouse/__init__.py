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

# Prevents wrong values inputs and overflow (i.e. text, float, values lesser than min or greater than max)
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
    ws_client = WebSocketClient("ws://<websocket_server_ip>:8765")
    hass.data[DOMAIN] = ws_client  # store globally

    """Set up the async handle_scroll service component."""
    @callback
    async def handle_scroll(call: ServiceCall) -> None:
        x = call.data.get("x")
        y = call.data.get("y")
        _LOGGER.debug(f"handle_scroll.call.data.x: {x}")
        _LOGGER.debug(f"handle_scroll.call.data.y: {y}")

        # Use shared client
        ws_client = hass.data[DOMAIN]
        _LOGGER.debug("ws_client retrieved")

        # Send command to RPI HID
        try:
            await ws_client.send_scroll(x, y)
            _LOGGER.debug(f"ws_client.send_scroll(x, y): {x},{y}")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_scroll: {e}")

    """Set up the async handle_move service component."""
    @callback
    async def handle_move(call: ServiceCall) -> None:
        x = call.data.get("x")
        y = call.data.get("y")
        _LOGGER.debug(f"handle_move.call.data.x: {x}")
        _LOGGER.debug(f"handle_move.call.data.y: {y}")

        # Use shared client
        ws_client = hass.data[DOMAIN]
        _LOGGER.debug("ws_client retrieved")

        # Send command to RPI HID
        try:
            await ws_client.send_move(x, y)
            _LOGGER.debug(f"ws_client.send_move(x, y): {x},{y}")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_move: {e}")

    """Set up the async handle_clickleft service component."""
    @callback
    async def handle_clickleft(call: ServiceCall) -> None:
        # Use shared client
        ws_client = hass.data[DOMAIN]
        _LOGGER.debug("ws_client retrieved")

        # Send command to RPI HID
        try:
            await ws_client.send_clickleft()
            _LOGGER.debug("ws_client.send_clickleft")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_clickleft: {e}")

    """Set up the async handle_clickmiddle service component."""
    @callback
    async def handle_clickmiddle(call: ServiceCall) -> None:
        # Use shared client
        ws_client = hass.data[DOMAIN]
        _LOGGER.debug("ws_client retrieved")

        # Send command to RPI HID
        try:
            await ws_client.send_clickmiddle()
            _LOGGER.debug("ws_client.send_clickmiddle")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_clickmiddle: {e}")

    """Set up the async handle_clickright service component."""
    @callback
    async def handle_clickright(call: ServiceCall) -> None:
        # Use shared client
        ws_client = hass.data[DOMAIN]
        _LOGGER.debug("ws_client retrieved")

        # Send command to RPI HID
        try:
            await ws_client.send_clickright()
            _LOGGER.debug("ws_client.send_clickright")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_clickright: {e}")

    """Set up the async handle_clickrelease service component."""
    @callback
    async def handle_clickrelease(call: ServiceCall) -> None:
        # Use shared client
        ws_client = hass.data[DOMAIN]
        _LOGGER.debug("ws_client retrieved")

        # Send command to RPI HID
        try:
            await ws_client.send_clickrelease()
            _LOGGER.debug("ws_client.send_clickrelease")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_clickrelease: {e}")

    # Register our services with Home Assistant.
    hass.services.async_register(DOMAIN, "scroll", handle_scroll, schema=MOVE_SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, "move", handle_move, schema=MOVE_SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, "clickleft", handle_clickleft)
    hass.services.async_register(DOMAIN, "clickmiddle", handle_clickmiddle)
    hass.services.async_register(DOMAIN, "clickright", handle_clickright)
    hass.services.async_register(DOMAIN, "clickrelease", handle_clickrelease)

    # Return boolean to indicate that initialization was successfully.
    return True
