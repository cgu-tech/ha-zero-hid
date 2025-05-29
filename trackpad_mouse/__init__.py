from __future__ import annotations

import logging
import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.typing import ConfigType
from homeassistant.helpers import config_validation as cv
from homeassistant.components.hassio.handler import HassIO
from homeassistant.components.hassio import async_start_addon, async_stop_addon

from .const import DOMAIN, ADDON_SLUG

_LOGGER = logging.getLogger(__name__)

MOVE_SERVICE_SCHEMA = vol.Schema({
    vol.Required("x"): vol.Coerce(int),
    vol.Required("y"): vol.Coerce(int),
})

async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the trackpad mouse integration."""

    @callback
    async def handle_start(call):
        await async_start_addon(hass, ADDON_SLUG)

    @callback
    async def handle_stop(call):
        await async_stop_addon(hass, ADDON_SLUG)

    @callback
    async def handle_move(call: ServiceCall) -> None:
        x = call.data["x"]
        y = call.data["y"]
        command = f"move:{x},{y}\n"

        # Call supervisor API to write to stdin
        _LOGGER.debug("Sending to add-on via stdin: %s", command.strip())
        response = await hass.components.hassio.send_command(
            {
                "type": "addons",
                "slug": ADDON_SLUG,
                "command": "stdin",
                "data": command,
            }
        )

        if not response.get("result") == "ok":
            _LOGGER.error("Failed to send command to add-on: %s", response)
        else:
            _LOGGER.debug("Command sent successfully to add-on.")

    # Register our services with Home Assistant.
    hass.services.async_register(DOMAIN, "start_addon", handle_start)
    hass.services.async_register(DOMAIN, "stop_addon", handle_stop)
    hass.services.async_register(DOMAIN, "move", handle_move, schema=MOVE_SERVICE_SCHEMA)

    # Return boolean to indicate that initialization was successfully.
    return True
