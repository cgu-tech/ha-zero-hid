#!/bin/bash
# Inspired from https://github.com/thewh1teagle/zero-hid/blob/main/usb_gadget/installer

install() {
    # Create HA client integration
    (rm -rf /config/custom_components/trackpad_mouse >/dev/null 2>&1 || true) && cp -R ha-zero-hid/client/custom_components /config
    
    # Enable HA client integration
    grep -qxF "trackpad_mouse:" /config/configuration.yaml || echo "trackpad_mouse:" >> /config/configuration.yaml
    
    # Setup HA client integration: setup USB gadget server IP
    read -p "USB gadget server IP (RPI zero 2w IP): " websocket_server_ip && 
    
    regex='^((25[0-5]|(2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9]))\.){3}(25[0-5]|(2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9]))$'
    read -p "Specify USB gadget server IP (RPI zero 2w IP): " websocket_server_ip </dev/tty
    while true; do
        if [[ $websocket_server_ip =~ $regex ]]; then
            sed -i "s/<websocket_server_ip>/${websocket_server_ip}/g" /config/custom_components/trackpad_mouse/__init__.py
            echo "Websocket server IP v4 set to ${websocket_server_ip}"
            break
            ;;
        else
            echo "Please answer a valid websocket server IP v4 (vvv.xxx.yyy.zzz)"
        fi
    done
    
    # Create HA client custom trackpad card
    (rm /config/www/trackpad-card.js >/dev/null 2>&1 || true) && cp -R ha-zero-hid/client/www /config
}

uninstall () {
    # Remove HA client custom trackpad card
    rm /config/www/trackpad-card.js >/dev/null 2>&1 || true
    
    # Disable HA client integration
    sed -i '/^trackpad_mouse:$/d' /config/configuration.yaml
    
    # Remove HA client integration
    rm -rf /config/custom_components/trackpad_mouse >/dev/null 2>&1 || true
}

if [ -d "/config/custom_components/trackpad_mouse" ]; then
    echo "Looks like HA zero-hid client integration is already installed"
    read -p "Do you want to uninstall it? (Y/n) " yn </dev/tty
    case $yn in
        [Yy]* )
            uninstall
            echo "Done uninstalling HA zero-hid client integration."
            exit 0;;
        [Nn]* ) exit 0;;
        * ) echo "Please answer yes or no.";;
    esac
else
    install
    echo "Installed HA zero-hid client integration"
fi
