from __future__ import annotations

import logging
import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.components.websocket_api import (
    websocket_command,
    async_response,
    async_register_command,
)

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

def ensure_list_or_empty(val):
    if val is None:
        return []
    if isinstance(val, list):
        return val
    return [val]

KEYPRESS_SERVICE_SCHEMA = vol.Schema({
    vol.Optional("sendModifiers", default=[]): vol.All(lambda v: v or [], ensure_list_or_empty),
    vol.Optional("sendKeys", default=[]): vol.All(lambda v: v or [], ensure_list_or_empty),
})

@websocket_command({vol.Required("type"): "trackpad_mouse/sync_keyboard"})
@async_response
async def websocket_sync_keyboard(hass, connection, msg):
    ws_client = hass.data[DOMAIN]
    _LOGGER.debug("ws_client retrieved")

    try:
        sync_state = await ws_client.sync_keyboard()
        _LOGGER.debug(f"sync_keyboard(): {sync_state}")

        connection.send_result(msg["id"], {
            "syncModifiers": sync_state.get("modifiers", []),
            "syncKeys": sync_state.get("keys", []),
            "syncNumlock": bool(sync_state.get("numlock", False)),
            "syncCapslock": bool(sync_state.get("capslock", False)),
            "syncScrolllock": bool(sync_state.get("scrolllock", False)),
        })
    except Exception as e:
        _LOGGER.exception("Error in sync_keyboard")
        connection.send_error(msg["id"], "sync_failed", str(e))

async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the websocket global client."""
    ws_client = WebSocketClient("ws://<websocket_server_ip>:8765")
    hass.data[DOMAIN] = ws_client  # store globally

    """Handle scrolling mouse."""
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

    """Handle moving mouse cursor."""
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

    """Handle pressing left mouse button."""
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

    """Handle pressing middle mouse button."""
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

    """Handle pressing right mouse button."""
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

    """Handle releasing all mouse buttons."""
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

    """Handle pressing/releasing keyboard keys."""
    @callback
    async def handle_keypress(call: ServiceCall) -> None:
        modifiers = call.data.get("sendModifiers")
        keys = call.data.get("sendKeys")
        _LOGGER.debug(f"handle_keypress.call.data.sendModifiers: {modifiers}")
        _LOGGER.debug(f"handle_keypress.call.data.sendKeys: {keys}")

        # Use shared client
        ws_client = hass.data[DOMAIN]
        _LOGGER.debug("ws_client retrieved")

        # Send command to RPI HID
        try:
            await ws_client.send_keypress(modifiers, keys)
            _LOGGER.debug(f"ws_client.send_keypress(modifiers, keys): {modifiers},{keys}")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_keypress: {e}")

    # Register our services with Home Assistant.
    hass.services.async_register(DOMAIN, "scroll", handle_scroll, schema=MOVE_SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, "move", handle_move, schema=MOVE_SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, "clickleft", handle_clickleft)
    hass.services.async_register(DOMAIN, "clickmiddle", handle_clickmiddle)
    hass.services.async_register(DOMAIN, "clickright", handle_clickright)
    hass.services.async_register(DOMAIN, "clickrelease", handle_clickrelease)
    hass.services.async_register(DOMAIN, "keypress", handle_keypress, schema=KEYPRESS_SERVICE_SCHEMA)

    # Register WebSocket command
    async_register_command(hass, websocket_sync_keyboard)

    # Return boolean to indicate that initialization was successfully.
    return True
