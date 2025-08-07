from __future__ import annotations

import asyncio
import logging
import os
import time

from homeassistant.core import HomeAssistant
from homeassistant.components.lovelace import LovelaceData

from .const import RESOURCES_VERSION, COMPONENT_VERSION_FILE, DOMAIN, RESOURCES_URL_BASE, RESOURCES, RESOURCES_LAST_SYNC_TIME, RESOURCES_SYNC_INTERVAL

_LOGGER = logging.getLogger(__name__)
_LOCK = asyncio.Lock()  # Prevent race conditions

class ResourcesVersions:
    def __init__(self):
        self.are_equal: bool | None = None
        self.file_value: str | None = None
        self.module_value: str | None = None
        self.reference_source: str | None = None
        self.reference_value: str | None = None

async def set_resources_versions(hass: HomeAssistant, write_to_file: bool, resources_versions: ResourcesVersions | None) -> None:
    global RESOURCES_VERSION
    version_file = COMPONENT_VERSION_FILE

    def write_version_to_file() -> str:
        _LOGGER.debug(f"Writing version {resources_versions.reference_value} to file {version_file}...")
        with open(version_file, 'w', encoding='utf-8') as f:
            f.write(resources_versions.reference_value)
            _LOGGER.debug(f"Version {resources_versions.reference_value} written to file {version_file}")

    # Set reference value into file (when different)
    if resources_versions.file_value != resources_versions.reference_value and write_to_file:
        await hass.async_add_executor_job(write_version_to_file)

    # Set reference value into module (when different)
    if resources_versions.module_value != resources_versions.reference_value:
        RESOURCES_VERSION = resources_versions.reference_value

async def get_resources_versions(hass: HomeAssistant, read_from_file: bool) -> ResourcesVersions | None:
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

    resources_versions: ResourcesVersions | None = ResourcesVersions()
    resources_versions.are_equal = are_equal
    resources_versions.file_value = file_value
    resources_versions.module_value = module_value
    resources_versions.reference_source = reference_source
    resources_versions.reference_value = reference_value
    return resources_versions

async def synchronize_resources(hass: HomeAssistant, use_version_file: bool, force_sync: bool) -> ResourcesVersions | None:
    _LOGGER.debug(f"Synchronizing resources (use_version_file={use_version_file})...")

    resources_versions: ResourcesVersions | None = None
    async with _LOCK:

        # Retrieve resources versions
        resources_versions = await get_resources_versions(hass, use_version_file)
        _LOGGER.debug(f"resources_versions: file={resources_versions.file_value}, module={resources_versions.module_value}")

        # Retrieve Lovelace object with frontend resources
        lovelace: LovelaceData = hass.data.get("lovelace")
        _LOGGER.debug(f"Lovelace mode set to \"{lovelace.mode}\"")

        if lovelace.mode == "storage":
            if force_sync or (use_version_file and not resources_versions.are_equal):
                
                if force_sync:
                    # Forced synchonization to avoid infinite loop in case of DEV MODE misuse 
                    # (ie. install in DEV MODE and instant reboot without going first on Lovelace dashboard to trigger resources registration)
                    _LOGGER.debug(f"Registering Lovelace resources for {DOMAIN} component...")
                else:
                    # File and module versions are different
                    _LOGGER.warning(
                        f"Outdated version detected: file version {resources_versions.file_value} and module version {resources_versions.module_value} are different. " +
                        f"Resources versions will be synchronized to {resources_versions.reference_source} version {resources_versions.reference_value}."
                    )

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

async def synchronize_resources_heuristically(hass: HomeAssistant) -> ResourcesVersions | None:
    global RESOURCES_LAST_SYNC_TIME
    current_time = time.monotonic()  # monotonic for elapsed time

    # Compute delta since last sync
    delta = current_time - RESOURCES_LAST_SYNC_TIME
    _LOGGER.debug(f"delta:{delta}, current_time={current_time}, RESOURCES_LAST_SYNC_TIME={RESOURCES_LAST_SYNC_TIME}, RESOURCES_SYNC_INTERVAL={RESOURCES_SYNC_INTERVAL}")

    resources_versions: ResourcesVersions | None = None
    if delta > RESOURCES_SYNC_INTERVAL:
        RESOURCES_LAST_SYNC_TIME = current_time
        resources_versions = await synchronize_resources(hass, use_version_file=True, force_sync=False)
    else:
        resources_versions = await synchronize_resources(hass, use_version_file=False, force_sync=False)
    return resources_versions
