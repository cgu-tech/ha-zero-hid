#!/bin/bash
# Inspired from https://github.com/thewh1teagle/zero-hid/blob/main/usb_gadget/installer

# === Parameters ===
ZERO_HID_BRANCH="${1:-main}"
SKIP_UPDATE="${2:-}"

# === Configurations ===
KEY_FILE="server.key"
CERT_FILE="server.crt"
PEM_FILE="server.pem"
OPENSSL_CONFIG_FILE="openssl.cnf"
ZERO_HID_REPO="https://github.com/cgu-tech/zero-hid.git"
HA_ZERO_HID_HOME="/home/ha_zero_hid"
CONFIG_FILE="${HA_ZERO_HID_HOME}/trackpad_mouse.config"
MODULE_FILE="/opt/ha_zero_hid/websockets_server.py"

# === Functions ===
check_root() {
    ROOTUID="0"
    if [ "$(id -u)" -ne "$ROOTUID" ] ; then
        echo "This script must be executed with root privileges."
        exit 1
    fi
}

create_cert() {
    # === Clean up previous files (optional) ===
    rm -f "$KEY_FILE" "$CERT_FILE" "$PEM_FILE" "$OPENSSL_CONFIG_FILE"
    
    # === Create a minimal OpenSSL config file ===
    cat > "$OPENSSL_CONFIG_FILE" <<EOF
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
    
    # === Generate private key ===
    openssl genrsa -out "$KEY_FILE" 2048
    
    # === Generate self-signed certificate that expires in 100 years ===
    openssl req -new -x509 -key "$KEY_FILE" -out "$CERT_FILE" -days 365000 -config "$OPENSSL_CONFIG_FILE"
    
    # === Combine into PEM file ===
    cat "$CERT_FILE" "$KEY_FILE" > "$PEM_FILE"
    
    # === Set file permissions ===
    chmod 600 "$KEY_FILE"
    chmod 644 "$CERT_FILE" "$PEM_FILE"
    
    # === Cleanup config file ===
    rm -f "$OPENSSL_CONFIG_FILE"
    
    echo "Self-signed certificate, key, and PEM generated:"
    echo " - $KEY_FILE"
    echo " - $CERT_FILE"
    echo " - $PEM_FILE"
}

install() {
    # Create server
    mkdir -p /opt/ha_zero_hid
    cp logging.conf /opt/ha_zero_hid/
    cp websockets_server_run.sh /opt/ha_zero_hid/
    cp websockets_server.py /opt/ha_zero_hid/
    chmod +x /opt/ha_zero_hid/websockets_server_run.sh
    
    # Create python venv for server and install dependencies
    if [ -z "$SKIP_UPDATE" ]; then
        echo "Updating apt and installing required packages..."
        apt-get update
        apt-get install -y git python3-pip python3-venv git
    else
        echo "Skipping apt-get update and install as requested (SKIP_UPDATE is set)."
    fi
    echo "Creating python venv..."
    python3 -m venv /opt/ha_zero_hid/venv
    source /opt/ha_zero_hid/venv/bin/activate
    
    # Install Python dependency "zero_hid" (custom)
    # TODO: install official dependency using "pip install zero_hid", 
    #       once PR is merged to official code-base: https://github.com/thewh1teagle/zero-hid/pull/39
    echo "Cloning zero-hid dependency using branch ${ZERO_HID_BRANCH}..."
    (rm -rf zero-hid >/dev/null 2>&1 || true) && git clone -b "${ZERO_HID_BRANCH}" "${ZERO_HID_REPO}"
    mv zero-hid /opt/ha_zero_hid/
    pip install --editable /opt/ha_zero_hid/zero-hid
    
    # Install Python dependency "websockets" (official)
    pip install websockets
    
    # Security: create user+group dedicated to service
    (useradd --system -m -d "${HA_ZERO_HID_HOME}" ha_zero_hid >/dev/null 2>&1 || true)
    mkdir -p /home/ha_zero_hid
    chown ha_zero_hid:ha_zero_hid /home/ha_zero_hid
    chmod 750 /home/ha_zero_hid
    
    # Config server parameters
    websocket_server_port=""
    
    # Config flags
    conf_websocket_server_port=false
    
    # Automatic setup : try loading config file
    if [ -f "${CONFIG_FILE}" ]; then
        
        # Automatic setup of "websocket_server_port"
        websocket_server_port=$(grep "^websocket_server_port:" "${CONFIG_FILE}" | cut -d':' -f2- ) # Retrieve from file
        websocket_server_port=$(echo "$websocket_server_port" | xargs) # Trims whitespace
        if [ -n "${websocket_server_port}" ]; then
            conf_websocket_server_port=true
            echo "Using pre-configured 'websocket_server_port' value ${websocket_server_port} from ${CONFIG_FILE}"
        else
            echo "Key 'websocket_server_port' not found or has no value in ${CONFIG_FILE}"
        fi
      
    else
        # Automatic setup : no config file or config file not accessible
        echo "Config file not found: ${CONFIG_FILE}"
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

    # Write updated config file
    echo "Writing config file ${CONFIG_FILE}..."
    cat <<EOF > "${CONFIG_FILE}"
websocket_server_port: ${websocket_server_port}
EOF

    # Configure using new configurations
    echo "Configuring trackpad_mouse server..."
    sed -i "s|<websocket_server_port>|${websocket_server_port}|g" "${MODULE_FILE}"
    echo "This USB gadget server will be running at 0.0.0.0:${websocket_server_port}"
    
    
    chown -R :ha_zero_hid /opt/ha_zero_hid
    chmod -R g+w /opt/ha_zero_hid

    # Security: create self-signed certificate
    #   server.key – private key
    #   server.crt – self-signed certificate
    #   server.pem – combined certificate + key (sometimes used)
    create_cert
    cp "$CERT_FILE" /opt/ha_zero_hid/
    cp "$KEY_FILE" /opt/ha_zero_hid/
    chown -R ha_zero_hid:ha_zero_hid /opt/ha_zero_hid/"$CERT_FILE" 
    chown -R ha_zero_hid:ha_zero_hid /opt/ha_zero_hid/"$KEY_FILE"

    # Configure systemd unit
    cp websockets_server.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable websockets_server.service
    
    # Start service
    systemctl start websockets_server.service
}

uninstall () {
    if [ -f "${CONFIG_FILE}" ]; then
        read -rp "Keep server config? (y/n) " confirm </dev/tty
        case "$confirm" in
            [Yy]* )
                echo "Config file not deleted (${CONFIG_FILE})"
                ;;
            [Nn]* )
                # Cleaning up server custom config file
                rm "${CONFIG_FILE}" >/dev/null 2>&1 || true
                echo "Config file deleted (${CONFIG_FILE})"
                ;;
            * )
                echo "Please answer y or n."
                exit 1
                ;;
        esac
    fi
    
    # Stop service
    systemctl stop websockets_server.service
    
    # Remove systemd unit
    systemctl disable websockets_server.service
    rm -rf /etc/systemd/system/websockets_server.service
    systemctl daemon-reload
    
    # Remove server
    rm -rf /opt/ha_zero_hid
}

check_root
if [ -f "/opt/ha_zero_hid/websockets_server_run.sh" ]; then
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
