#!/bin/bash
# Inspired from https://github.com/thewh1teagle/zero-hid/blob/main/usb_gadget/installer

install() {
    # Create HA client integration
    (rm -rf /config/custom_components/trackpad_mouse >/dev/null 2>&1 || true) && cp -R custom_components /config
    
    # Enable HA client integration
    grep -qxF "trackpad_mouse:" /config/configuration.yaml || echo "trackpad_mouse:" >> /config/configuration.yaml
    
    # Setup HA client integration: setup USB gadget server IP
    regex='^((25[0-5]|(2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9]))\.){3}(25[0-5]|(2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9]))$'
    read -p "Enter USB gadget server IP v4 LAN address (ex: 192.168.1.15): " websocket_server_ip </dev/tty
    while true; do
        if [[ $websocket_server_ip =~ $regex ]]; then
            sed -i "s/<websocket_server_ip>/${websocket_server_ip}/g" /config/custom_components/trackpad_mouse/__init__.py
            echo "USB gadget server IP v4 LAN address set to ${websocket_server_ip}"
            break
        else
            echo "Please answer a valid IP v4 address (vvv.xxx.yyy.zzz)"
        fi
    done
    
    # Cleanup existing client elements when needed
    rm /config/www/trackpad-card.js >/dev/null 2>&1 || true
    
    rm /config/www/windows-keyboard-card.js >/dev/null 2>&1 || true
    rm /config/www/layouts/windows/FR.json >/dev/null 2>&1 || true
    
    rm /config/www/azerty-android-keyboard-card.js >/dev/null 2>&1 || true
    rm /config/www/icon_opened_apps.svg >/dev/null 2>&1 || true
    
    # Install all client elements
    cp -R www /config
}

uninstall () {
    # Cleanup existing client elements when needed
    rm /config/www/trackpad-card.js >/dev/null 2>&1 || true
    
    rm /config/www/windows-keyboard-card.js >/dev/null 2>&1 || true
    rm /config/www/layouts/windows/FR.json >/dev/null 2>&1 || true
    
    rm /config/www/azerty-android-keyboard-card.js >/dev/null 2>&1 || true
    rm /config/www/icon_opened_apps.svg >/dev/null 2>&1 || true
    
    # Disable HA client integration
    sed -i '/^trackpad_mouse:$/d' /config/configuration.yaml
    
    # Remove HA client integration
    rm -rf /config/custom_components/trackpad_mouse >/dev/null 2>&1 || true
}

if [ -d "/config/custom_components/trackpad_mouse" ]; then
    echo "Looks like HA zero-hid client integration is already installed"
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
                    echo "Reinstalled/updated HA zero-hid client integration."
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
                    echo "Uninstalled HA zero-hid client integration."
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
    echo "Installed HA zero-hid client integration"
fi
