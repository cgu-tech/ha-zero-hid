#!/bin/bash
CURRENT_DIR="$(pwd)"

# Parameters
ZERO_HID_REPO_BRANCH="${1:-main}"
OS_SKIP_UPDATE="${2:-}"

# Configurations
OS_SERVICE_DIR="/etc/systemd/system"
OS_SERVICE_USER="ha_zero_hid"
OS_SERVICE_USER_DIR="/home/${OS_SERVICE_USER}"

ZERO_HID_REPO_URL="https://github.com/cgu-tech/zero-hid.git"
ZERO_HID_REPO_DIR="${CURRENT_DIR}/zero-hid"

HA_ZERO_HID_REPO_SERVER_DIR="${CURRENT_DIR}/component"
HA_ZERO_HID_REPO_SERVICE_DIR="${CURRENT_DIR}/service"

HA_ZERO_HID_SERVER_NAME="${OS_SERVICE_USER}"

HA_ZERO_HID_SERVER_DIR="/opt/${HA_ZERO_HID_SERVER_NAME}"
HA_ZERO_HID_SERVER_VENV_DIR="${HA_ZERO_HID_SERVER_DIR}/venv"
HA_ZERO_HID_SERVER_START_FILE="${HA_ZERO_HID_SERVER_DIR}/websockets_server_run.sh"
HA_ZERO_HID_SERVER_INIT_FILE="${HA_ZERO_HID_SERVER_DIR}/websockets_server.py"
HA_ZERO_HID_SERVER_LOG_CONFIG_FILE="${HA_ZERO_HID_SERVER_DIR}/logging.conf"
HA_ZERO_HID_SERVER_PRIVATE_KEY_FILE="${CURRENT_DIR}/server.key"
HA_ZERO_HID_SERVER_CERT_FILE="${CURRENT_DIR}/server.crt"
HA_ZERO_HID_SERVER_CERT_DAYS=365000
HA_ZERO_HID_SERVER_SSL_CONFIG_FILE="openssl.cnf"

HA_ZERO_HID_SERVICE_NAME="websockets_server"
HA_ZERO_HID_SERVICE_FILE_NAME="${HA_ZERO_HID_SERVICE_NAME}.service"
HA_ZERO_HID_SERVICE_FILE="${OS_SERVICE_DIR}/${HA_ZERO_HID_SERVICE_FILE_NAME}"

HA_ZERO_HID_CONFIG_FILE="${OS_SERVICE_USER_DIR}/${HA_ZERO_HID_SERVER_NAME}.config"

# Clean-up:
# - systemctl service stop, remove, reload (service)
# - server resources (sh, py, key, crt, ...)
# - server dedicated config (config)
# - dependencies (zero-hid repository)
cleanup() {
    local should_delete_config="$1"

    # Stopping service
    echo "Stopping ${HA_ZERO_HID_SERVER_NAME} service ${HA_ZERO_HID_SERVICE_FILE_NAME} (${HA_ZERO_HID_SERVICE_FILE})..."
    systemctl stop "${HA_ZERO_HID_SERVICE_FILE_NAME}"

    # Removing service from systemctl
    echo "Removing ${HA_ZERO_HID_SERVER_NAME} service ${HA_ZERO_HID_SERVER_NAME} from systemctl config (${HA_ZERO_HID_SERVICE_FILE})..."
    systemctl disable "${HA_ZERO_HID_SERVICE_FILE_NAME}"

    # Deleting service
    echo "Cleaning ${HA_ZERO_HID_SERVER_NAME} service file ${HA_ZERO_HID_SERVICE_FILE}..."
    rm -rf "${HA_ZERO_HID_SERVICE_FILE}" >/dev/null 2>&1 || true

    # Apply changes to systemctl config
    echo "Reloading systemctl to apply changes..."
    systemctl daemon-reload

    # Remove server
    echo "Cleaning ${HA_ZERO_HID_SERVER_NAME} server files ${HA_ZERO_HID_SERVER_DIR}..."
    rm -rf "${HA_ZERO_HID_SERVER_DIR}"

    # Cleaning up component custom config file when explicitely required
    if [ "${should_delete_config}" != "true" ]; then
      echo "Cleaning ${HA_ZERO_HID_SERVER_NAME} config file (${HA_ZERO_HID_CONFIG_FILE})..."
      rm "${HA_ZERO_HID_CONFIG_FILE}" >/dev/null 2>&1 || true
    fi

    # Cleaning up component dependencies
    echo "Cleaning ${HA_ZERO_HID_SERVER_NAME} zero-hid dependency (${ZERO_HID_REPO_DIR})..."
    rm -rf "${ZERO_HID_REPO_DIR}" >/dev/null 2>&1 || true
}

# Check if current user is root
check_root() {
    ROOTUID="0"
    if [ "$(id -u)" -ne "$ROOTUID" ] ; then
        echo "This script must be executed with root privileges."
        exit 1
    fi
}

create_cert() {

    # Create temporary ssl config file for self-signed server certificate generation
    echo "Creating temporary ssl config ${HA_ZERO_HID_SERVER_SSL_CONFIG_FILE}..."
    cat > "${HA_ZERO_HID_SERVER_SSL_CONFIG_FILE}" <<EOF
    [ req ]
    default_bits       = 1024
    prompt             = no
    default_md         = sha256
    distinguished_name = dn
    
    [ dn ]
    C  = XX
    ST = State
    L  = City
    O  = MyOrg
    OU = MyUnit
    CN = localhost
EOF
    
    # Generate private key (no password)
    echo "Creating private key file ${HA_ZERO_HID_SERVER_PRIVATE_KEY_FILE}..."
    openssl genrsa -out "${HA_ZERO_HID_SERVER_PRIVATE_KEY_FILE}" 2048
    
    # Generate server self-signed certificate that expires in 100 years (365k days)
    echo "Creating self-signed certificate file ${HA_ZERO_HID_SERVER_CERT_FILE}: " \
         "valid for ${HA_ZERO_HID_SERVER_CERT_DAYS} day(s), " \
         "using private key ${HA_ZERO_HID_SERVER_PRIVATE_KEY_FILE}, " \
         "using ssl config ${HA_ZERO_HID_SERVER_SSL_CONFIG_FILE}..."
    openssl req -new -x509 \
      -key "${HA_ZERO_HID_SERVER_PRIVATE_KEY_FILE}" \
      -out "${HA_ZERO_HID_SERVER_CERT_FILE}" \
      -days ${HA_ZERO_HID_SERVER_CERT_DAYS} \
      -config "${HA_ZERO_HID_SERVER_SSL_CONFIG_FILE}"

    # Delete temporary config file
    echo "Deleting temporary ssl config ${HA_ZERO_HID_SERVER_SSL_CONFIG_FILE}..."
    rm -f "${HA_ZERO_HID_SERVER_SSL_CONFIG_FILE}"

    # Enforce server private key file rights (writable and readable only by user)
    echo "Enforcing server private key file rights ${HA_ZERO_HID_SERVER_PRIVATE_KEY_FILE}..."
    chmod 600 "${HA_ZERO_HID_SERVER_PRIVATE_KEY_FILE}"

    # Enforce server certificate file rights (writable and readable only by user, readable by anyone else)
    echo "Enforcing server certificate file rights ${HA_ZERO_HID_SERVER_CERT_FILE}..."
    chmod 644 "${HA_ZERO_HID_SERVER_CERT_FILE}"
}

install() {
    # ------------------
    # Installing raw components files
    # ------------------

    # Installing raw server files
    echo "Installing ${HA_ZERO_HID_SERVER_NAME} server..."
    mkdir -p "${HA_ZERO_HID_SERVER_DIR}"
    cp -R "${HA_ZERO_HID_REPO_SERVER_DIR}" "${HA_ZERO_HID_SERVER_DIR}"

    # Installing raw server service files
    echo "Installing ${HA_ZERO_HID_SERVER_NAME} server service..."
    mkdir -p "${OS_SERVICE_DIR}"
    cp -R "${HA_ZERO_HID_REPO_SERVICE_DIR}" "${OS_SERVICE_DIR}"

    echo "Cloning zero-hid repository at ${ZERO_HID_REPO_URL}, on branch ${ZERO_HID_REPO_BRANCH}..."
    git clone -b "${ZERO_HID_REPO_BRANCH}" "${ZERO_HID_REPO_URL}"

    # Update system and install dependencies
    echo "Skip policy: ${OS_SKIP_UPDATE}"
    if [ -z "${OS_SKIP_UPDATE}" ]; then
        echo "Updating system..."
        apt-get update

        echo "Installing system required packages (git, python3-pip, python3-venv)..."
        apt-get install -y git python3-pip python3-venv
    else
        echo "System update skipped"
        echo "System required packages install skipped (git, python3-pip, python3-venv)"
    fi

    # Create python venv for server
    echo "Creating python venv..."
    python3 -m venv "${HA_ZERO_HID_SERVER_VENV_DIR}"
    source "${HA_ZERO_HID_SERVER_VENV_DIR}/bin/activate"

    # Install Python dependency "websockets" (official)
    echo "Installing python websockets dependency..."
    pip install websockets

    # Install Python dependency "zero-hid" (custom)
    # TODO: incorporate sources directly instead of building a development python dependency
    echo "Installing python zero-hid dependency..."
    cp "${ZERO_HID_REPO_DIR}" "${HA_ZERO_HID_SERVER_DIR}"
    pip install --editable "${HA_ZERO_HID_SERVER_DIR}/zero-hid"

    # Create server dedicated OS user
    echo "Creating server user ${OS_SERVICE_USER}..."
    (useradd --system -m -d "${OS_SERVICE_USER_DIR}" "${OS_SERVICE_USER}" >/dev/null 2>&1 || true)

    echo "Creating home ${OS_SERVICE_USER_DIR} for server user ${OS_SERVICE_USER}..."
    mkdir -p "${OS_SERVICE_USER_DIR}"

    echo "Giving ownership for server user ${OS_SERVICE_USER} to its home ${OS_SERVICE_USER_DIR}..."
    chown "${OS_SERVICE_USER}":"${OS_SERVICE_USER}" "${OS_SERVICE_USER_DIR}"
    
    echo "Giving rights for server user ${OS_SERVICE_USER} to its home ${OS_SERVICE_USER_DIR}..."
    chmod 750 "${OS_SERVICE_USER_DIR}"

    # ------------------
    # Retrieving configs
    # ------------------

    # Config server parameters
    websocket_server_log_level=""
    websocket_server_port=""
    websocket_server_secret=""
    websocket_authorized_clients_ips=""

    # Config flags
    conf_websocket_server_log_level=false
    conf_websocket_server_port=false
    conf_websocket_server_secret=false
    conf_websocket_authorized_clients_ips=false

    # Automatic setup : try loading config file
    if [ -f "${HA_ZERO_HID_CONFIG_FILE}" ]; then

        # Automatic setup of "websocket_server_log_level"
        websocket_server_log_level=$(grep "^websocket_server_log_level:" "${HA_ZERO_HID_CONFIG_FILE}" | cut -d':' -f2- ) # Retrieve from file
        websocket_server_log_level=$(echo "$websocket_server_log_level" | xargs) # Trims whitespace
        if [ -n "${websocket_server_log_level}" ]; then
            conf_websocket_server_log_level=true
            echo "Using pre-configured 'websocket_server_log_level' value ${websocket_server_log_level} from ${HA_ZERO_HID_CONFIG_FILE}"
        else
            echo "Key 'websocket_server_log_level' not found or has no value in ${HA_ZERO_HID_CONFIG_FILE}"
        fi

        # Automatic setup of "websocket_server_port"
        websocket_server_port=$(grep "^websocket_server_port:" "${HA_ZERO_HID_CONFIG_FILE}" | cut -d':' -f2- ) # Retrieve from file
        websocket_server_port=$(echo "$websocket_server_port" | xargs) # Trims whitespace
        if [ -n "${websocket_server_port}" ]; then
            conf_websocket_server_port=true
            echo "Using pre-configured 'websocket_server_port' value ${websocket_server_port} from ${HA_ZERO_HID_CONFIG_FILE}"
        else
            echo "Key 'websocket_server_port' not found or has no value in ${HA_ZERO_HID_CONFIG_FILE}"
        fi

        # Automatic setup of "websocket_server_secret"
        websocket_server_secret=$(grep "^websocket_server_secret:" "${HA_ZERO_HID_CONFIG_FILE}" | cut -d':' -f2- ) # Retrieve from file
        websocket_server_secret=$(echo "$websocket_server_secret" | xargs) # Trims whitespace
        # Remove surrounding single quotes, if any:
        websocket_server_secret="${websocket_server_secret#\'}"
        websocket_server_secret="${websocket_server_secret%\'}"
        if [ -n "${websocket_server_secret}" ]; then
            conf_websocket_server_secret=true
            echo "Using pre-configured 'websocket_server_secret' value ${websocket_server_secret} from ${HA_ZERO_HID_CONFIG_FILE}"
        else
            echo "Key 'websocket_server_secret' not found or has no value in ${HA_ZERO_HID_CONFIG_FILE}"
        fi

        # Automatic setup of "websocket_authorized_clients_ips"
        websocket_authorized_clients_ips=$(grep "^websocket_authorized_clients_ips:" "${HA_ZERO_HID_CONFIG_FILE}" | cut -d':' -f2- ) # Retrieve from file
        websocket_authorized_clients_ips=$(echo "$websocket_authorized_clients_ips" | xargs) # Trims whitespace
        if [ -n "${websocket_authorized_clients_ips}" ]; then
            conf_websocket_authorized_clients_ips=true
            echo "Using pre-configured 'websocket_authorized_clients_ips' value ${websocket_authorized_clients_ips} from ${HA_ZERO_HID_CONFIG_FILE}"
        else
            echo "Key 'websocket_authorized_clients_ips' not found or has no value in ${HA_ZERO_HID_CONFIG_FILE}"
        fi

    else
        # Automatic setup : no config file or config file not accessible
        echo "Config file not found: ${HA_ZERO_HID_CONFIG_FILE}"
    fi

    # Manual setup of "websocket_server_log_level":
    if [ "${conf_websocket_server_log_level}" != "true" ]; then
        regex='^(CRITICAL|ERROR|WARNING|INFO|DEBUG)$'
        while true; do
            read -p "Enter this USB gadget server logger level (default: WARNING, available: CRITICAL,ERROR,WARNING,INFO,DEBUG): " websocket_server_log_level </dev/tty
            websocket_server_log_level=$(echo "$websocket_server_log_level" | xargs) # Trims whitespace
            if [ -z "${websocket_server_log_level}" ]; then
                websocket_server_log_level="WARNING"
                echo "Using default WARNING server port"
                break
            elif [[ ${websocket_server_log_level} =~ ${regex} ]]; then
                break
            else
                echo "Please answer one of the following logger level: CRITICAL,ERROR,WARNING,INFO,DEBUG"
            fi
        done
    fi

    # Manual setup of "websocket_server_port":
    if [ "${conf_websocket_server_port}" != "true" ]; then
        regex='^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$'
        while true; do
            read -p "Enter this USB gadget server port (default: 8765): " websocket_server_port </dev/tty
            websocket_server_port=$(echo "$websocket_server_port" | xargs) # Trims whitespace
            if [ -z "${websocket_server_port}" ]; then
                websocket_server_port="8765"
                echo "Using default 8765 server port"
                break
            elif [[ ${websocket_server_port} =~ ${regex} ]]; then
                break
            else
                echo "Please answer a well-formed server port (vvvvv expected, where 1 <= vvvvv <= 65535)"
            fi
        done
    fi

    # Manual setup of "websocket_server_secret":
    if [ "${conf_websocket_server_secret}" != "true" ]; then
        regex='^.+$'
        while true; do
            read -p "Enter this USB gadget server secret (ex: myServerSecret): " websocket_server_secret </dev/tty
            websocket_server_secret=$(echo "$websocket_server_secret" | xargs) # Trims whitespace
            if [[ "$websocket_server_secret" =~ $regex ]]; then
                break
            else
                echo "Please answer a well-formed secret (non-empty and non-whitespaces-only secret expected)"
            fi
        done
    fi

    # Manual setup of "websocket_authorized_clients_ips":
    if [ "${conf_websocket_authorized_clients_ips}" != "true" ]; then
        regex='^([0-9]{1,3}\.){3}[0-9]{1,3}([[:space:]]*,[[:space:]]*([0-9]{1,3}\.){3}[0-9]{1,3})*$'
        while true; do
            read -p "Enter your USB gadget authorized clients IPv4 addresses (ex: 192.168.1.15,..,127.0.0.1): " websocket_authorized_clients_ips </dev/tty
            websocket_authorized_clients_ips=$(echo "$websocket_authorized_clients_ips" | xargs) # Trims whitespace
            if [[ ${websocket_authorized_clients_ips} =~ ${regex} ]]; then
                break
            else
                echo "Please answer a well-formed list of authorized clients IPv4 addresses (ex: 192.168.1.15,..,127.0.0.1 expected)"
            fi
        done
    fi

    # Write updated config file
    echo "Writing config file ${HA_ZERO_HID_CONFIG_FILE}..."
    cat <<EOF > "${HA_ZERO_HID_CONFIG_FILE}"
websocket_server_log_level: ${websocket_server_log_level}
websocket_server_port: ${websocket_server_port}
websocket_server_secret: '${websocket_server_secret}'
websocket_authorized_clients_ips: ${websocket_authorized_clients_ips}
EOF

    # ------------------
    # Templating raw component files
    # ------------------

    # Templating client component raw files with configurations
    echo "Configuring ${HA_ZERO_HID_SERVER_NAME} server..."

    echo "Templating ${HA_ZERO_HID_SERVER_NAME} server log level to ${websocket_server_log_level} into ${HA_ZERO_HID_SERVER_LOG_CONFIG_FILE}..."
    sed -i "s|<websocket_server_log_level>|${websocket_server_log_level}|g" "${HA_ZERO_HID_SERVER_LOG_CONFIG_FILE}"
    echo "Use this command to setup logger level after installation: sed -i \"s|${websocket_server_log_level}|<new_log_level>|g\" \"${HA_ZERO_HID_SERVER_LOG_CONFIG_FILE}\""

    echo "Templating ${HA_ZERO_HID_SERVER_NAME} server LAN address to 0.0.0.0:${websocket_server_port} into ${HA_ZERO_HID_SERVER_INIT_FILE}..."
    sed -i "s|<websocket_server_port>|${websocket_server_port}|g" "${HA_ZERO_HID_SERVER_INIT_FILE}"

    echo "Templating ${HA_ZERO_HID_SERVER_NAME} server secret to ${websocket_server_secret} into ${HA_ZERO_HID_SERVER_INIT_FILE}..."
    sed -i "s|<websocket_server_secret>|${websocket_server_secret}|g" "${HA_ZERO_HID_SERVER_INIT_FILE}"

    echo "Templating ${HA_ZERO_HID_SERVER_NAME} server authorized clients IPs to ${websocket_authorized_clients_ips} into ${HA_ZERO_HID_SERVER_INIT_FILE}..."
    sed -i "s|<websocket_authorized_clients_ips>|${websocket_authorized_clients_ips}|g" "${HA_ZERO_HID_SERVER_INIT_FILE}"

    # Security: create self-signed certificate
    #   server.key – private key
    #   server.crt – self-signed certificate
    #   server.pem – combined certificate + key (sometimes used)
    create_cert
    cp "${HA_ZERO_HID_SERVER_CERT_FILE}" "${HA_ZERO_HID_SERVER_DIR}/"
    cp "${HA_ZERO_HID_SERVER_PRIVATE_KEY_FILE}" "${HA_ZERO_HID_SERVER_DIR}/"
    chown -R "${OS_SERVICE_USER}":"${OS_SERVICE_USER}" "${HA_ZERO_HID_SERVER_DIR}/${HA_ZERO_HID_SERVER_CERT_FILE}" 
    chown -R "${OS_SERVICE_USER}":"${OS_SERVICE_USER}" "${HA_ZERO_HID_SERVER_DIR}/${HA_ZERO_HID_SERVER_PRIVATE_KEY_FILE}"
    
    echo "Give ${OS_SERVICE_USER} user's group ownership and rights to ${HA_ZERO_HID_SERVER_DIR} server directory..."
    chown -R :"${OS_SERVICE_USER}" "${HA_ZERO_HID_SERVER_DIR}"
    chmod -R g+w "${HA_ZERO_HID_SERVER_DIR}"

    echo "Give execution rights for all users to ${HA_ZERO_HID_SERVER_START_FILE} server start script..."
    chmod +x "${HA_ZERO_HID_SERVER_START_FILE}"

    # Configure systemd unit
    echo "Reloading systemctl to apply changes..."
    systemctl daemon-reload

    echo "Adding ${HA_ZERO_HID_SERVER_NAME} service ${HA_ZERO_HID_SERVICE_FILE_NAME} to systemctl config (${HA_ZERO_HID_SERVICE_FILE})..."
    systemctl enable "${HA_ZERO_HID_SERVICE_FILE_NAME}"
    
    # Start service
    echo "Starting ${HA_ZERO_HID_SERVER_NAME} service ${HA_ZERO_HID_SERVICE_FILE_NAME}..."
    systemctl start "${HA_ZERO_HID_SERVICE_FILE_NAME}"
}

uninstall () {
    delete_component_conf_file=false
    if [ -f "${HA_ZERO_HID_CONFIG_FILE}" ]; then
        read -rp "Keep server config? (y/n) " confirm </dev/tty
        case "$confirm" in
            [Yy]* )
                echo "Config file will not be deleted (${HA_ZERO_HID_CONFIG_FILE})"
                ;;
            [Nn]* )
                echo "Config file will be deleted (${HA_ZERO_HID_CONFIG_FILE})"
                delete_component_conf_file=true
                ;;
            * )
                echo "Please answer y or n."
                exit 1
                ;;
        esac
    fi

    # Effective removal
    cleanup "${delete_component_conf_file}"
}

check_root
if [ -f "${HA_ZERO_HID_SERVER_START_FILE}" ]; then
    echo "HA zero-hid websockets server is already installed."
    echo "Please choose an option:"
    echo "  1) Reinstall or update"
    echo "  2) Uninstall"
    echo "  3) Exit"
    read -rp "Enter choice [1-3]: " choice </dev/tty

    case "$choice" in
        1)
            read -rp "Are you sure you want to reinstall or update? (y/n) " confirm </dev/tty
            case "$confirm" in
                [Yy]* )
                    uninstall
                    install
                    echo "Reinstalled/updated HA zero-hid websockets server."
                    exit 0
                    ;;
                [Nn]* )
                    echo "Operation cancelled."
                    exit 0
                    ;;
                * )
                    echo "Please answer y or n."
                    exit 1
                    ;;
            esac
            ;;
        2)
            read -rp "Are you sure you want to uninstall? (y/n) " confirm </dev/tty
            case "$confirm" in
                [Yy]* )
                    uninstall
                    echo "Uninstalled HA zero-hid websockets server."
                    exit 0
                    ;;
                [Nn]* )
                    echo "Operation cancelled."
                    exit 0
                    ;;
                * )
                    echo "Please answer y or n."
                    exit 1
                    ;;
            esac
            ;;
        3)
            echo "Exiting script."
            exit 0
            ;;
        *)
            echo "Invalid choice, exiting."
            exit 1
            ;;
    esac

else
    install
    echo "Installed HA zero-hid websockets server"
fi
