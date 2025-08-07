from __future__ import annotations

import asyncio
import logging
import os
import re
import time
import voluptuous as vol

from datetime import datetime

from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.components.lovelace import LovelaceData
from homeassistant.components.websocket_api.connection import ActiveConnection
from homeassistant.components.websocket_api import websocket_command, async_response, async_register_command
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.event import async_call_later
from homeassistant.helpers.typing import ConfigType

from typing import Set, TypedDict
from .websocket_handler import WebSocketClient
from .const import DOMAIN, MIN_RANGE, MAX_RANGE

_LOGGER = logging.getLogger(__name__)
_LOCK = asyncio.Lock()  # Prevent race conditions

# Frontend user_ids whitelist
AUTHORIZED_USERS: Set[str] = set(ip.strip() for ip in "<websocket_authorized_users_ids>".split(","))

# Backend server config
SERVER_HOST = "<websocket_server_ip>"
SERVER_PORT = <websocket_server_port>
SERVER_SECRET = "<websocket_server_secret>"

# Backend component
COMPONENT_DIR = f"/config/custom_components/{DOMAIN}"
COMPONENT_VERSION_FILE = f"{COMPONENT_DIR}/version"

# Frontend Lovelace resources
EVENT_LOVELACE_UPDATED: Final = "lovelace_updated"
RESOURCES_DOMAIN = "<ha_resources_domain>"
RESOURCES_DIR = f"/config/www/{RESOURCES_DOMAIN}"
RESOURCES_URL_BASE = f"/local/{RESOURCES_DOMAIN}"
RESOURCES_VERSION = "<ha_resources_version>"
RESOURCES = [
    "android-keyboard-card.js",
    "android-remote-card.js",
    "arrowpad-card.js",
    "carrousel-card.js",
    "trackpad-card.js",
    "windows-keyboard-card.js",
]
RESOURCES_LAST_SYNC_TIME = 0
RESOURCES_SYNC_INTERVAL = 5

class ResourcesVersions:
    def __init__(self):
        self.are_equal: bool | None = None
        self.file_value: str | None = None
        self.module_value: str | None = None
        self.reference_source: str | None = None
        self.reference_value: str | None = None

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

def ensure_string_or_empty(val):
    if val is None:
        return ""
    if isinstance(val, str):
        return val
    return str(val)

CHARTAP_SERVICE_SCHEMA = vol.Schema({
    vol.Optional("sendChars", default=""): vol.All(lambda v: v or "", ensure_string_or_empty),
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

CONPRESS_SERVICE_SCHEMA = vol.Schema({
    vol.Optional("sendCons", default=[]): vol.All(lambda v: v or [], ensure_list_or_empty),
})

LOG_SERVICE_SCHEMA = vol.Schema({
    vol.Required("level"): vol.All(lambda v: v or "", ensure_string_or_empty),
    vol.Required("logs"): vol.All(lambda v: v or [], ensure_list_or_empty),
})

def get_ws_client(hass: HomeAssistant) -> WebSocketClient:
    return hass.data[DOMAIN]["ws_client"]

def get_authorized_users(hass: HomeAssistant) -> Set[str]:
    return hass.data[DOMAIN]["authorized_users"]

def is_user_authorized(hass: HomeAssistant, user_id: str) -> bool:
    """Check if the user is authorized."""
    if user_id is None:
        _LOGGER.debug("Unauthenticated: no user ID found")
        return False

    authorized_users = get_authorized_users(hass)
    if user_id not in authorized_users:
        _LOGGER.debug(f"Unauthenticated: user ID ({user_id}) is not authorized")
        return False

    _LOGGER.debug(f"Authenticated: user ID ({user_id}) is authorized")
    return True

def is_user_authorized_from_service(hass: HomeAssistant, call: ServiceCall) -> bool:
    context = call.context
    if not context:
        _LOGGER.debug("Unauthenticated: no context found")
        return False

    user_id = context.user_id
    return is_user_authorized(hass, user_id)

def is_user_authorized_from_command(hass: HomeAssistant, connection: ActiveConnection) -> bool:
    user = connection.user
    if not user:
        _LOGGER.debug("Unauthenticated: no user found")
        return False

    user_id = user.id
    return is_user_authorized(hass, user_id)

async def set_resources_versions(hass: HomeAssistant, write_to_file: bool, resources_versions: ResourcesVersions) -> None:
    version_file = COMPONENT_VERSION_FILE

    def write_version_to_file() -> str:
        _LOGGER.debug(f"Writing version {resources_versions.reference_value} to file {version_file}...")
        with open(version_file, 'w', encoding='utf-8') as f:
            f.write(resources_versions.reference_value)
            _LOGGER.debug(f"Version {resources_versions.reference_value} written to file {version_file}")

    if write_to_file:
        await hass.async_add_executor_job(write_version_to_file)
    RESOURCES_VERSION = resources_versions.reference_value

async def get_resources_versions(hass: HomeAssistant, read_from_file: bool) -> ResourcesVersions:
    version_file = COMPONENT_VERSION_FILE

    def read_version_from_file() -> str:
        _LOGGER.debug(f"Reading version from file {version_file}...")
        if os.path.exists(version_file):
            # version_file exists: read the timestamp
            with open(version_file, 'r', encoding='utf-8') as f:
                version_from_file = f.read().strip()
                _LOGGER.debug(f"Version {version_from_file} read from file {version_file}")
                return version_from_file
        return ""

    are_equal: bool | None = None
    file_value: str | None = None
    module_value: str = RESOURCES_VERSION
    reference_source: str = "module"
    reference_value: str = module_value

    if read_from_file:
        file_value = await hass.async_add_executor_job(read_version_from_file)

        if file_value:
            are_equal = file_value == module_value
        else:
            are_equal = False

        if not are_equal:
            versions = [file_value,module_value]
            versions_sorted = sorted([version for version in versions if version], reverse=True)
            reference_value = versions_sorted[0]
            if reference_value != module_value:
                reference_source = "file"

    resources_versions = ResourcesVersions()
    resources_versions.are_equal = are_equal
    resources_versions.file_value = file_value
    resources_versions.module_value = module_value
    resources_versions.reference_source = reference_source
    resources_versions.reference_value = reference_value
    return resources_versions

async def synchronize_resources(hass: HomeAssistant, use_version_file: bool) -> ResourcesVersions:
    _LOGGER.debug(f"Synchronizing resources (use_version_file={use_version_file})...")

    resources_versions: ResourcesVersions = None
    async with _LOCK:

        # Retrieve resources versions
        resources_versions = await get_resources_versions(hass, use_version_file)
        _LOGGER.debug(f"resources_versions: file={resources_versions.file_value}, module={resources_versions.module_value}")

        # Retrieve Lovelace object with frontend resources
        lovelace = hass.data.get("lovelace")
        _LOGGER.debug(f"Lovelace mode set to \"{lovelace.mode}\"")

        if lovelace.mode == "storage":
            if use_version_file and not resources_versions.are_equal:
                # File and module versions are different

                _LOGGER.warning(f"""
                Outdated version detected: file version {resources_versions.file_value} and module version {resources_versions.module_value} are different. 
                Resources versions will be synchronized to {resources_versions.reference_source} version {resources_versions.reference_value}.
                """)

                # Load existing Lovelace resources
                if not lovelace.resources.loaded:
                    _LOGGER.debug("Loading Lovelace resources...")
                    await lovelace.resources.async_get_info()
                if not lovelace.resources.loaded:
                    # Cannot load Lovelace existing resources
                    _LOGGER.exception("Cannot load Lovelace resources: ensure Home Assistant codebase did not changed (check for .loaded inside .async_get_info())")
                    return

                # Retrieve existing Lovelace resources linked to this component
                _LOGGER.debug(f"Retrieving existing Lovelace resources linked to {DOMAIN} component...")
                existing_resources = {
                    resource["url"]: resource["id"]
                    for resource in lovelace.resources.async_items()
                    if resource["url"].startswith(RESOURCES_URL_BASE)
                }

                # Create up-to-date resources URLs for this component
                _LOGGER.debug(f"Retrieving up-to-date {DOMAIN} component resources...")
                uptodate_resources_urls = {f"{RESOURCES_URL_BASE}/{resource}?v={resources_versions.reference_value}" for resource in RESOURCES}

                # Remove existing outdated Lovelace resources
                for url, id in existing_resources.items():
                    if url not in uptodate_resources_urls:
                        _LOGGER.debug(f"Removing existing outdated Lovelace resource: {url} (id: {id})")
                        await lovelace.resources.async_delete_item(id)

                # Create missing up-to-date resources
                for url in uptodate_resources_urls:
                    if url not in existing_resources:
                        _LOGGER.debug(f"Creating up-to-date resource: {url}")
                        await lovelace.resources.async_create_item(
                            {
                                "res_type": "module",
                                "url": url
                            }
                        )

                await set_resources_versions(hass, use_version_file, resources_versions)
                _LOGGER.info(f"Lovelace resources for custom component {DOMAIN} successfully updated to version {resources_versions.reference_value}")

            else:
                _LOGGER.debug(f"Custom Lovelace resources already synced for custom component {DOMAIN}")
        else:
            _LOGGER.warning(f"Lovelace mode is not \"storage\": manually declare those resources {RESOURCES} using base URL {RESOURCES_URL_BASE}")

    return resources_versions

@websocket_command({vol.Required("type"): DOMAIN + "/sync_keyboard"})
@async_response
async def websocket_sync_keyboard(hass: HomeAssistant, connection: ActiveConnection, msg):
    authorized = is_user_authorized_from_command(hass, connection)
    if not authorized:
        return

    ws_client = get_ws_client(hass)
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

@websocket_command({vol.Required("type"): DOMAIN + "/sync_resources"})
@async_response
async def websocket_sync_resources(hass: HomeAssistant, connection: ActiveConnection, msg):
    try:
        global RESOURCES_LAST_SYNC_TIME
        current_time = time.monotonic()  # monotonic for elapsed time

        # Compute delta since last sync
        delta = current_time - RESOURCES_LAST_SYNC_TIME
        _LOGGER.debug(f"delta:{delta}, current_time={current_time}, RESOURCES_LAST_SYNC_TIME={RESOURCES_LAST_SYNC_TIME}, RESOURCES_SYNC_INTERVAL={RESOURCES_SYNC_INTERVAL}")

        resources_versions = None
        if delta > RESOURCES_SYNC_INTERVAL:
            RESOURCES_LAST_SYNC_TIME = current_time
            resources_versions = await synchronize_resources(hass, use_version_file=True)
        else:
            resources_versions = await synchronize_resources(hass, use_version_file=False)

        connection.send_result(msg["id"], {"resourcesVersion": resources_versions.reference_value})

    except Exception as e:
        _LOGGER.exception("Error in resources_version")
        connection.send_error(msg["id"], "resources_version_failed", str(e))


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the websocket global client."""
    ws_client = WebSocketClient(f"wss://{SERVER_HOST}:{SERVER_PORT}", SERVER_SECRET)
    hass.data[DOMAIN] = {
        "ws_client": ws_client,
        "authorized_users": AUTHORIZED_USERS,
    }

    """Handle scrolling mouse."""
    @callback
    async def handle_scroll(call: ServiceCall) -> None:
        authorized = is_user_authorized_from_service(hass, call)
        if not authorized:
            return

        x = call.data.get("x")
        y = call.data.get("y")
        if _LOGGER.getEffectiveLevel() == logging.DEBUG:
            _LOGGER.debug(f"handle_scroll.call.data.x: {x}")
            _LOGGER.debug(f"handle_scroll.call.data.y: {y}")

        ws_client = get_ws_client(hass)
        try:
            await ws_client.send_scroll(x, y)
            if _LOGGER.getEffectiveLevel() == logging.DEBUG:
                _LOGGER.debug(f"ws_client.send_scroll(x, y): {x},{y}")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_scroll: {e}")

    """Handle moving mouse cursor."""
    @callback
    async def handle_move(call: ServiceCall) -> None:
        authorized = is_user_authorized_from_service(hass, call)
        if not authorized:
            return

        x = call.data.get("x")
        y = call.data.get("y")
        if _LOGGER.getEffectiveLevel() == logging.DEBUG:
            _LOGGER.debug(f"handle_move.call.data.x: {x}")
            _LOGGER.debug(f"handle_move.call.data.y: {y}")

        ws_client = get_ws_client(hass)
        try:
            await ws_client.send_move(x, y)
            if _LOGGER.getEffectiveLevel() == logging.DEBUG:
                _LOGGER.debug(f"ws_client.send_move(x, y): {x},{y}")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_move: {e}")

    """Handle pressing left mouse button."""
    @callback
    async def handle_clickleft(call: ServiceCall) -> None:
        authorized = is_user_authorized_from_service(hass, call)
        if not authorized:
            return

        ws_client = get_ws_client(hass)
        try:
            await ws_client.send_clickleft()
            _LOGGER.debug("ws_client.send_clickleft")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_clickleft: {e}")

    """Handle pressing middle mouse button."""
    @callback
    async def handle_clickmiddle(call: ServiceCall) -> None:
        authorized = is_user_authorized_from_service(hass, call)
        if not authorized:
            return

        ws_client = get_ws_client(hass)
        try:
            await ws_client.send_clickmiddle()
            _LOGGER.debug("ws_client.send_clickmiddle")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_clickmiddle: {e}")

    """Handle pressing right mouse button."""
    @callback
    async def handle_clickright(call: ServiceCall) -> None:
        authorized = is_user_authorized_from_service(hass, call)
        if not authorized:
            return

        ws_client = get_ws_client(hass)
        try:
            await ws_client.send_clickright()
            _LOGGER.debug("ws_client.send_clickright")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_clickright: {e}")

    """Handle releasing all mouse buttons."""
    @callback
    async def handle_clickrelease(call: ServiceCall) -> None:
        authorized = is_user_authorized_from_service(hass, call)
        if not authorized:
            return

        ws_client = get_ws_client(hass)
        try:
            await ws_client.send_clickrelease()
            _LOGGER.debug("ws_client.send_clickrelease")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_clickrelease: {e}")

    """Handle taping keyboard chars."""
    @callback
    async def handle_chartap(call: ServiceCall) -> None:
        authorized = is_user_authorized_from_service(hass, call)
        if not authorized:
            return

        chars = call.data.get("sendChars")
        if _LOGGER.getEffectiveLevel() == logging.DEBUG:
            _LOGGER.debug(f"handle_chartap.call.data.sendChars: {chars}")

        ws_client = get_ws_client(hass)
        try:
            await ws_client.send_chartap(chars)
            _LOGGER.debug(f"ws_client.send_chartap(chars): {chars}")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_chartap: {e}")

    """Handle pressing/releasing keyboard keys."""
    @callback
    async def handle_keypress(call: ServiceCall) -> None:
        authorized = is_user_authorized_from_service(hass, call)
        if not authorized:
            return

        modifiers = call.data.get("sendModifiers")
        keys = call.data.get("sendKeys")
        if _LOGGER.getEffectiveLevel() == logging.DEBUG:
            _LOGGER.debug(f"handle_keypress.call.data.sendModifiers: {modifiers}")
            _LOGGER.debug(f"handle_keypress.call.data.sendKeys: {keys}")

        ws_client = get_ws_client(hass)
        try:
            await ws_client.send_keypress(modifiers, keys)
            _LOGGER.debug(f"ws_client.send_keypress(modifiers, keys): {modifiers},{keys}")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_keypress: {e}")

    """Handle pressing/releasing consumer keyboard keys."""
    @callback
    async def handle_conpress(call: ServiceCall) -> None:
        authorized = is_user_authorized_from_service(hass, call)
        if not authorized:
            return

        cons = call.data.get("sendCons")
        if _LOGGER.getEffectiveLevel() == logging.DEBUG:
            _LOGGER.debug(f"handle_conpress.call.data.sendCons: {cons}")

        ws_client = get_ws_client(hass)
        try:
            await ws_client.send_conpress(cons)
            _LOGGER.debug(f"ws_client.send_conpress(cons): {cons}")
        except Exception as e:
            _LOGGER.exception(f"Unhandled error in handle_conpress: {e}")

    """Handle logging to home assistant backend."""
    @callback
    async def handle_log(call: ServiceCall) -> None:
        authorized = is_user_authorized_from_service(hass, call)
        if not authorized:
            return

        level = call.data.get("level")
        logs = call.data.get("logs")
        fmt = "[CLIENT][%s]" + (" %s" * len(logs))
        if level == "TRA":
            if _LOGGER.getEffectiveLevel() == logging.DEBUG:
                _LOGGER.debug(fmt, level, *logs)
        elif level == "DBG":
            if _LOGGER.getEffectiveLevel() == logging.DEBUG:
                _LOGGER.debug(fmt, level, *logs)
        elif level == "INF":
            if _LOGGER.getEffectiveLevel() == logging.INFO:
                _LOGGER.info(fmt, level, *logs)
        elif level == "WRN":
            if _LOGGER.getEffectiveLevel() == logging.WARNING:
                _LOGGER.warning(fmt, level, *logs)
        elif level == "ERR":
            if _LOGGER.getEffectiveLevel() == logging.ERROR:
                _LOGGER.error(fmt, level, *logs)
        else:
            if _LOGGER.getEffectiveLevel() == logging.CRITICAL:
                _LOGGER.critical(fmt, level, *logs)

    # Register our services with Home Assistant.
    hass.services.async_register(DOMAIN, "scroll", handle_scroll, schema=MOVE_SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, "move", handle_move, schema=MOVE_SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, "clickleft", handle_clickleft)
    hass.services.async_register(DOMAIN, "clickmiddle", handle_clickmiddle)
    hass.services.async_register(DOMAIN, "clickright", handle_clickright)
    hass.services.async_register(DOMAIN, "clickrelease", handle_clickrelease)
    hass.services.async_register(DOMAIN, "chartap", handle_chartap, schema=CHARTAP_SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, "keypress", handle_keypress, schema=KEYPRESS_SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, "conpress", handle_conpress, schema=CONPRESS_SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, "log", handle_log, schema=LOG_SERVICE_SCHEMA)

    # Register WebSocket command
    async_register_command(hass, websocket_sync_keyboard)
    async_register_command(hass, websocket_sync_resources)

    # Register frontend resources
    await synchronize_resources(hass, use_version_file=True)

    # Return boolean to indicate that initialization was successfully.
    return True
