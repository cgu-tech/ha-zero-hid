#!/bin/bash
# Inspired from https://github.com/thewh1teagle/zero-hid/blob/main/usb_gadget/installer

CONFIG_FILE="/config/trackpad_mouse.config"
MODULE_FILE="/config/custom_components/trackpad_mouse/__init__.py"

cleanup() {
    # Cleanup existing client elements when needed
    rm /config/www/utils/logger.js >/dev/null 2>&1 || true
    
    rm /config/www/trackpad-card.js >/dev/null 2>&1 || true
    
    rm /config/www/windows-keyboard-card.js >/dev/null 2>&1 || true
    rm /config/www/layouts/windows/FR.json >/dev/null 2>&1 || true
    rm /config/www/layouts/windows/US.json >/dev/null 2>&1 || true
    
    rm /config/www/android-keyboard-card.js >/dev/null 2>&1 || true
    rm /config/www/layouts/android/FR.json >/dev/null 2>&1 || true
    rm /config/www/layouts/android/FR-remote.json >/dev/null 2>&1 || true
    rm /config/www/layouts/android/US.json >/dev/null 2>&1 || true
    rm /config/www/layouts/android/US-remote.json >/dev/null 2>&1 || true
    rm /config/www/icon_opened_apps.svg >/dev/null 2>&1 || true
    
    rm /config/www/arrowpad-card.js >/dev/null 2>&1 || true
    rm /config/www/layouts/arrowpad/common.json >/dev/null 2>&1 || true
    
    rm /config/www/android-remote-card.js >/dev/null 2>&1 || true
}

install() {
    # Create HA client integration
    (rm -rf /config/custom_components/trackpad_mouse >/dev/null 2>&1 || true) && cp -R custom_components /config
    
    # Enable HA client integration
    grep -qxF "trackpad_mouse:" /config/configuration.yaml || echo "trackpad_mouse:" >> /config/configuration.yaml
    
    # Config flags
    is_websocket_server_ip_retrieved=false
    websocket_server_ip=""
    
    # Check if the config file exists
    if [ -f "${CONFIG_FILE}" ]; then
    
        # Try to retrieve the value of "websocket_server_ip"
        websocket_server_ip=$(grep "^websocket_server_ip:" "${CONFIG_FILE}" | cut -d':' -f2- | xargs)
        if [ -n "$websocket_server_ip" ]; then
            is_websocket_server_ip_retrieved=true
        else
            echo "Key 'websocket_server_ip' not found or has no value in ${CONFIG_FILE}"
        fi
      
    else
        echo "Config file not found: ${CONFIG_FILE}"
    fi
    
    
    # Setup HA client integration: setup USB gadget server IP
    regex='^((25[0-5]|(2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9]))\.){3}(25[0-5]|(2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9]))$'
    while true; do
        read -p "Enter your USB gadget server IPv4 address (ex: 192.168.1.15): " websocket_server_ip </dev/tty
        if [[ $websocket_server_ip =~ $regex ]]; then
            is_websocket_server_ip_retrieved=true
            break
        else
            echo "Please answer a well-formed IPv4 address (vvv.xxx.yyy.zzz expected, where 0 <= vvv <= 255, etc)"
        fi
    done
    
    # Write updated config file
    echo "Writing config file ${CONFIG_FILE}..."
    cat <<EOF > "${CONFIG_FILE}"
websocket_server_ip: ${websocket_server_ip}
EOF

    # Configure using new configurations
    echo "Configuring trackpad_mouse component..."
    sed -i "s|<websocket_server_ip>|${websocket_server_ip}|g" "${MODULE_FILE}"
    echo "USB gadget server IP v4 LAN address set to ${websocket_server_ip}"
    
    # Remove residual files when needed
    echo "Cleaning trackpad_mouse old component files..."
    cleanup
    
    # Copy all updated configured files to install client components
    echo "Installing trackpad_mouse newly configured component..."
    cp -R www /config
}

uninstall () {
    if [ -f "${CONFIG_FILE}" ]; then
    read -rp "Keep integration config? (y/n) " confirm </dev/tty
        case "$confirm" in
            [Yy]* )
                echo "Config file not deleted (${CONFIG_FILE})"
                ;;
            [Nn]* )
                # Cleaning up component custom config file
                rm "${CONFIG_FILE}" >/dev/null 2>&1 || true
                echo "Config file deleted (${CONFIG_FILE})"
                ;;
            * )
                echo "Please answer y or n."
                exit 1
                ;;
        esac
    fi
        
    # Disabling component into HA configuration
    sed -i '/^trackpad_mouse:$/d' /config/configuration.yaml
    
    # Cleaning up component python resources (py)
    rm -rf /config/custom_components/trackpad_mouse >/dev/null 2>&1 || true
    
    # Cleaning up component web resources (js, html, css, svg, ...)
    cleanup
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
