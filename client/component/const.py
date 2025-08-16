# Frontend Lovelace resources management
RESOURCES_LAST_SYNC_TIME = 0
RESOURCES_SYNC_INTERVAL = 5
RESOURCES_DOMAIN = "<ha_resources_domain>"
RESOURCES_URL_BASE = f"/local/{RESOURCES_DOMAIN}"
RESOURCES_VERSION = "<ha_resources_version>"
RESOURCES = [
    "android-keyboard-card.js",
    "android-remote-card.js",
    "arrowpad-card.js",
    "carrousel-card.js",
    "trackpad-card.js",
    "windows-keyboard-card.js",
    "test-card.js"
]

# This component name
DOMAIN = "<ha_component_name>"

# This component file structure
COMPONENT_DIR = f"/config/custom_components/{DOMAIN}"
COMPONENT_VERSION_FILE = f"{COMPONENT_DIR}/version"

# This component users whitelist enforcement
AUTHORIZED_USERS_IDS = "<websocket_authorized_users_ids>"

# This component values limits for received mouse movements
MIN_RANGE = -127
MAX_RANGE = 127

# Backend server config
SERVER_HOST = "<websocket_server_ip>"
SERVER_PORT = <websocket_server_port>
SERVER_SECRET = "<websocket_server_secret>"