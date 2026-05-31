# Frontend Lovelace resources management
RESOURCES_LAST_SYNC_TIME = 0
RESOURCES_SYNC_INTERVAL = 5
RESOURCES_DOMAIN = "<ha_resources_domain>"
RESOURCES_URL_BASE = f"/local/{RESOURCES_DOMAIN}"
RESOURCES_VERSION = "<ha_resources_version>"
RESOURCES = <ha_resources>

# This component name
DOMAIN = "<ha_component_name>"

# This component file structure
COMPONENT_DIR = f"/config/custom_components/{DOMAIN}"
COMPONENT_VERSION_FILE = f"{COMPONENT_DIR}/version"

# This component values limits for received mouse movements
MIN_RANGE = -127
MAX_RANGE = 127


# List of available websockets servers
# [
#   {
#       "id": "1",
#       "name": "livingroom",
#       "protocol": "wss",
#       "host": "192.168.1.10",
#       "port": 8765,
#       "secret": "abc123",
#       "authorized_users": ["user_id_1", "user_id_2"],
#   },
#   {
#       "id": "2",
#       "name": "kitchen",
#       "protocol": "wss",
#       "host": "192.168.1.11",
#       "port": 8765,
#       "secret": "xyz456",
#       "authorized_users": ["user_id_1"],
#   },
# ]
WEBSOCKET_SERVERS = <servers>

HASS_EVENT_TRACE = 0
HASS_EVENT_DEBUG = 1
HASS_EVENT_INFO = 2
HASS_EVENT_WARN = 3
HASS_EVENT_ERROR = 4
HASS_EVENT_CRITICAL = 5

HASS_CODE_ERROR_PI_UNREACHABLE = 0
HASS_CODE_ERROR_UNEXPECTED = 1
HASS_CODE_ERROR_USB_UNREACHABLE = 2