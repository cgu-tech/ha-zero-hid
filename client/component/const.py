# Frontend Lovelace resources management
RESOURCES_LAST_SYNC_TIME = 0
RESOURCES_SYNC_INTERVAL = 5
RESOURCES_DOMAIN = "<ha_resources_domain>"
RESOURCES_URL_BASE = f"/local/{RESOURCES_DOMAIN}"
RESOURCES_VERSION = "<ha_resources_version>"
RESOURCES = [
    {"file": "android-keyboard-card.js"},
    {"file": "android-remote-card.js"},
    {"file": "arrowpad-card.js"},
    {"file": "carrousel-card.js"},
    {"file": "trackpad-card.js"},
    {"file": "windows-keyboard-card.js"},
    {"file": "test-card.js"},
    {"file": "air-mouse-card.js"},
    {"file": "microphone-card.js"},
    {"file": "vacuum-card.js"},
    {"file": "more-info-custom-dialog.js"}
]

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
