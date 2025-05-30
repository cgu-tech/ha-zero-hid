#!/bin/bash
# Inspired from https://github.com/thewh1teagle/zero-hid/blob/main/usb_gadget/installer

check_root() {
    ROOTUID="0"
    if [ "$(id -u)" -ne "$ROOTUID" ] ; then
        echo "This script must be executed with root privileges."
        exit 1
    fi
}

install() {
    # Create the server
    mkdir -p /opt/ha_zero_hid
    cp websockets_server_run.sh /opt/ha_zero_hid/
    cp websockets_server.py /opt/ha_zero_hid/
    chmod +x /opt/ha_zero_hid/websockets_server_run.sh
    
    # Create python venv for server and install dependencies
    apt-get update
    apt-get install -y git python3-pip python3-venv git
    python3 -m venv /opt/ha_zero_hid/venv
    source /opt/ha_zero_hid/venv/bin/activate
    (rm -rf zero-hid >/dev/null 2>&1 || true) && git clone -b main https://github.com/cgu-tech/zero-hid.git
    pip install --editable zero-hid
    pip install websockets
    
    # Security: create user+group dedicated to service
    sudo useradd --system --no-create-home ha_zero_hid
    sudo chown -R :ha_zero_hid
    sudo chmod -R g+w /opt/ha_zero_hid
    
    # Configure systemd unit
    cp websockets_server.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable websockets_server.service
    
    # Start the service
    systemctl start websockets_server.service
}

uninstall () {
    # Stop the service
    systemctl stop websockets_server.service
    
    # Remove systemd unit
    systemctl disable websockets_server.service
    rm -rf /etc/systemd/system/websockets_server.service
    systemctl daemon-reload
    
    # Remove the server
    rm -rf /opt/ha_zero_hid
}

check_root
if [ -f "/opt/ha_zero_hid/websockets_server_run.sh" ]; then
    echo "Looks like HA zero-hid websockets server is already installed"
    read -p "Do you want to uninstall it? (Y/n) " yn </dev/tty
    case $yn in
        [Yy]* )
            uninstall
            echo "Done uninstalling HA zero-hid websockets server."
            exit 0;;
        [Nn]* ) exit 0;;
        * ) echo "Please answer yes or no.";;
    esac
else
    install
    echo "Installed HA zero-hid websockets server"
fi
