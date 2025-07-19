#!/bin/bash
# Inspired from https://github.com/thewh1teagle/zero-hid/blob/main/usb_gadget/installer

# === Parameters ===
ZERO_HID_BRANCH="${1:-main}"

# === Configurations ===
ZERO_HID_REPO="https://github.com/cgu-tech/zero-hid.git"
CONFIG_FILE="/config/trackpad_mouse.config"
MODULE_FILE="/config/custom_components/trackpad_mouse/__init__.py"

# === Functions ===
cleanup() {
    # Cleanup existing client elements when needed
    rm /config/www/utils/logger.js >/dev/null 2>&1 || true
    rm /config/www/utils/keycodes.js >/dev/null 2>&1 || true
    rm /config/www/utils/consumercodes.js >/dev/null 2>&1 || true
    
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
    
    rm /config/www/carrousel.js >/dev/null 2>&1 || true
    
    rm /config/www/android-remote-card.js >/dev/null 2>&1 || true
    rm /config/www/layouts/remote/classic.json >/dev/null 2>&1 || true
    rm /config/www/layouts/remote/extended-right.json >/dev/null 2>&1 || true
}

extract_keycodes_to_js_class() {
    local INPUT_PYTHON_FILE="$1"
    local OUTPUT_JS_FILE="$2"
    local OUTPUT_JS_CLASS="$3"

    if [[ ! -f "${INPUT_PYTHON_FILE}" ]]; then
        echo "Input file not found: ${INPUT_PYTHON_FILE}"
        return 1
    fi

    # Start the JS class
    {
        echo "export class ${OUTPUT_JS_CLASS} {"
        echo "  constructor() {"
        echo "    this._mapping = {"
    } > "${OUTPUT_JS_FILE}"

    # Append mapping from Python constants
    grep -E '^\s*[A-Z0-9_]+\s*=\s*(0x[0-9a-fA-F]+|\d+)' "${INPUT_PYTHON_FILE}" | while read -r line; do
        key=$(echo "$line" | cut -d '=' -f 1 | tr -d ' ')
        val=$(echo "$line" | cut -d '=' -f 2 | cut -d '#' -f 1 | tr -d ' ')

        # Convert hex to decimal if needed
        if [[ "$val" =~ ^0x ]]; then
            val=$(( val ))
        fi

        echo "      \"$key\": $val," >> "${OUTPUT_JS_FILE}"
    done

    # Remove trailing comma
    sed -i '' -e '$ s/,$//' "${OUTPUT_JS_FILE}" 2>/dev/null || sed -i '$ s/,$//' "${OUTPUT_JS_FILE}"

    # Close class and add getMapping()
    {
        echo "    };"
        echo "  }"
        echo ""
        echo "  getMapping() {"
        echo "    return this._mapping;"
        echo "  }"
        echo "}"
    } >> "${OUTPUT_JS_FILE}"

    echo "Python constants from ${INPUT_PYTHON_FILE} converted to JS class ${OUTPUT_JS_CLASS} in ${OUTPUT_JS_FILE}"
}


install() {
    CURRENT_DIR="$(pwd)"
    
    # Create HA client integration
    (rm -rf /config/custom_components/trackpad_mouse >/dev/null 2>&1 || true) && cp -R custom_components /config
    
    # Enable HA client integration
    grep -qxF "trackpad_mouse:" /config/configuration.yaml || echo "trackpad_mouse:" >> /config/configuration.yaml
    
    # Config parameters
    websocket_server_ip=""
    websocket_server_port=""
    websocket_authorized_users_ids=""
    
    # Config flags
    conf_websocket_server_ip=false
    conf_websocket_server_port=false
    conf_websocket_authorized_users_ids=false
    
    # Automatic setup : try loading config file
    if [ -f "${CONFIG_FILE}" ]; then
    
        # Automatic setup of "websocket_server_ip"
        websocket_server_ip=$(grep "^websocket_server_ip:" "${CONFIG_FILE}" | cut -d':' -f2- ) # Retrieve from file
        websocket_server_ip=$(echo "$websocket_server_ip" | xargs) # Trims whitespace
        if [ -n "${websocket_server_ip}" ]; then
            conf_websocket_server_ip=true
            echo "Using pre-configured 'websocket_server_ip' value ${websocket_server_ip} from ${CONFIG_FILE}"
        else
            echo "Key 'websocket_server_ip' not found or has no value in ${CONFIG_FILE}"
        fi
        
        # Automatic setup of "websocket_server_port"
        websocket_server_port=$(grep "^websocket_server_port:" "${CONFIG_FILE}" | cut -d':' -f2- ) # Retrieve from file
        websocket_server_port=$(echo "$websocket_server_port" | xargs) # Trims whitespace
        if [ -n "${websocket_server_port}" ]; then
            conf_websocket_server_port=true
            echo "Using pre-configured 'websocket_server_port' value ${websocket_server_port} from ${CONFIG_FILE}"
        else
            echo "Key 'websocket_server_port' not found or has no value in ${CONFIG_FILE}"
        fi

        # Automatic setup of "websocket_server_port"
        websocket_authorized_users_ids=$(grep "^websocket_authorized_users_ids:" "${CONFIG_FILE}" | cut -d':' -f2- ) # Retrieve from file
        websocket_authorized_users_ids=$(echo "$websocket_authorized_users_ids" | xargs) # Trims whitespace
        if [ -n "${websocket_authorized_users_ids}" ]; then
            conf_websocket_authorized_users_ids=true
            echo "Using pre-configured 'websocket_authorized_users_ids' value ${websocket_authorized_users_ids} from ${CONFIG_FILE}"
        else
            echo "Key 'websocket_authorized_users_ids' not found or has no value in ${CONFIG_FILE}"
        fi
      
    else
        # Automatic setup : no config file or config file not accessible
        echo "Config file not found: ${CONFIG_FILE}"
    fi

    # Manual setup of "websocket_server_ip":
    if [ "${conf_websocket_server_ip}" != "true" ]; then
        regex='^((25[0-5]|(2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9]))\.){3}(25[0-5]|(2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9]))$'
        while true; do
            read -p "Enter your USB gadget server IPv4 address (ex: 192.168.1.15): " websocket_server_ip </dev/tty
            websocket_server_ip=$(echo "$websocket_server_ip" | xargs) # Trims whitespace
            if [[ ${websocket_server_ip} =~ ${regex} ]]; then
                break
            else
                echo "Please answer a well-formed IPv4 address (vvv.xxx.yyy.zzz expected, where 0 <= vvv <= 255, etc)"
            fi
        done
    fi
    
    # Manual setup of "websocket_server_port":
    if [ "${conf_websocket_server_port}" != "true" ]; then
        regex='^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$'
        while true; do
            read -p "Enter your USB gadget server port (default: 8765): " websocket_server_port </dev/tty
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

    # Manual setup of "websocket_authorized_users_ids":
    if [ "${conf_websocket_authorized_users_ids}" != "true" ]; then
        regex='^ *"[^"]*" *(, *"[^"]*" *)* *$'
        while true; do
    
            # Display existing users
            /bin/bash user_activity_report.sh
    
            read -p "Enter list of authorized users ids (ex: \"userid_1\",..,\"userid_n\"): " websocket_authorized_users_ids </dev/tty

            # trim whitespace and preserve double-quotes
            websocket_authorized_users_ids="${websocket_authorized_users_ids#"${websocket_authorized_users_ids%%[![:space:]]*}"}"
            websocket_authorized_users_ids="${websocket_authorized_users_ids%"${websocket_authorized_users_ids##*[![:space:]]}"}"

            if [[ "$websocket_authorized_users_ids" =~ $regex ]]; then
                break
            else
                echo "Please answer a well-formed list of authorized users id (\"userid_1\",..,\"userid_n\" expected)"
            fi
        done
    fi

    # Write updated config file
    echo "Writing config file ${CONFIG_FILE}..."
    cat <<EOF > "${CONFIG_FILE}"
websocket_server_ip: ${websocket_server_ip}
websocket_server_port: ${websocket_server_port}
websocket_authorized_users_ids: '${websocket_authorized_users_ids}'
EOF

    # Configure using new configurations
    echo "Configuring trackpad_mouse component..."
    sed -i "s|<websocket_server_ip>|${websocket_server_ip}|g" "${MODULE_FILE}"
    sed -i "s|<websocket_server_port>|${websocket_server_port}|g" "${MODULE_FILE}"
    echo "USB gadget server IP v4 LAN address set to ${websocket_server_ip}:${websocket_server_port}"

    escaped_websocket_authorized_users_ids=$(printf '%s' "$websocket_authorized_users_ids" | sed 's/"/\\"/g')
    sed -i "s|<websocket_authorized_users_ids>|${escaped_websocket_authorized_users_ids}|g" "${MODULE_FILE}"
    echo "USB gadget server access authorization set to users with IDs ${websocket_authorized_users_ids}"

    # Remove residual files when needed
    echo "Cleaning trackpad_mouse old component files..."
    cleanup

    # Create key codes and consummer codes mappings from zero-hid
    echo "Cloning zero-hid dependency using branch ${ZERO_HID_BRANCH}..."
    (rm -rf zero-hid >/dev/null 2>&1 || true) && git clone -b "${ZERO_HID_BRANCH}" "${ZERO_HID_REPO}"

    echo "Creating key codes mapping..."
    extract_keycodes_to_js_class "${CURRENT_DIR}/zero-hid/zero_hid/hid/keycodes.py" "${CURRENT_DIR}/www/utils/keycodes.js" "KeyCodes"

    echo "Creating consummer codes mapping..."
    extract_keycodes_to_js_class "${CURRENT_DIR}/zero-hid/zero_hid/hid/consumercodes.py" "${CURRENT_DIR}/www/utils/consumercodes.js" "ConsumerCodes"

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
