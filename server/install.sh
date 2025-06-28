#!/bin/bash
# Inspired from https://github.com/thewh1teagle/zero-hid/blob/main/usb_gadget/installer

# Makes this script:
# -e (exit on error) Fail-fast on errors
# -u (unset variable is an error) Avoid silent bugs from typos or partial failures
# -o pipefail Safer and more predictable in production or automation
#set -euo pipefail

# === Configuration ===
KEY_FILE="server.key"
CERT_FILE="server.crt"
PEM_FILE="server.pem"
CONFIG_FILE="openssl.cnf"
ZERO_HID_BRANCH="${1:-main}"
SKIP_UPDATE="${2:-}"

check_root() {
    ROOTUID="0"
    if [ "$(id -u)" -ne "$ROOTUID" ] ; then
        echo "This script must be executed with root privileges."
        exit 1
    fi
}

create_cert() {
    # === Clean up previous files (optional) ===
    rm -f "$KEY_FILE" "$CERT_FILE" "$PEM_FILE" "$CONFIG_FILE"
    
    # === Create a minimal OpenSSL config file ===
    cat > "$CONFIG_FILE" <<EOF
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
    openssl genrsa -out "$KEY_FILE" 1024
    
    # === Generate self-signed certificate that expires in 100 years ===
    openssl req -new -x509 -key "$KEY_FILE" -out "$CERT_FILE" -days 365000 -config "$CONFIG_FILE"
    
    # === Combine into PEM file ===
    cat "$CERT_FILE" "$KEY_FILE" > "$PEM_FILE"
    
    # === Set file permissions ===
    chmod 600 "$KEY_FILE"
    chmod 644 "$CERT_FILE" "$PEM_FILE"
    
    # === Cleanup config file ===
    rm -f "$CONFIG_FILE"
    
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
    (rm -rf zero-hid >/dev/null 2>&1 || true) && git clone -b "${ZERO_HID_BRANCH}" https://github.com/cgu-tech/zero-hid.git
    mv zero-hid /opt/ha_zero_hid/
    pip install --editable /opt/ha_zero_hid/zero-hid
    
    # Install Python dependency "websockets" (official)
    pip install websockets
    
    # Security: create user+group dedicated to service
    (useradd --system --no-create-home ha_zero_hid >/dev/null 2>&1 || true)
    chown -R :ha_zero_hid /opt/ha_zero_hid
    chmod -R g+w /opt/ha_zero_hid

    # Security: create self-signed certificate
    #   server.key – private key
    #   server.crt – self-signed certificate
    #   server.pem – combined certificate + key (sometimes used)
    create_cert
    cp "$CERT_FILE" /opt/ha_zero_hid/
    cp "$KEY_FILE" /opt/ha_zero_hid/

    # Configure systemd unit
    cp websockets_server.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable websockets_server.service
    
    # Start service
    systemctl start websockets_server.service
}

uninstall () {
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
