#!/bin/bash
CURRENT_DIR="$(pwd)"

# Parameters
ZERO_HID_REPO_BRANCH="${1:-main}"
ENABLE_AUTO_MODE="${2:-}"
ENABLE_DEV_MODE="${3:-}"

# Configurations
HAOS_CONFIG_DIR="/config"
HAOS_CUSTOM_COMPONENTS_DIR="${HAOS_CONFIG_DIR}/custom_components"
HAOS_RESOURCES_DIR="${HAOS_CONFIG_DIR}/www"
HAOS_CONFIG_FILE="${HAOS_CONFIG_DIR}/configuration.yaml"

ZERO_HID_REPO_URL="https://github.com/cgu-tech/zero-hid.git"
ZERO_HID_REPO_DIR="${CURRENT_DIR}/zero-hid"

HA_ZERO_HID_REPO_COMPONENT_DIR="${CURRENT_DIR}/component"
HA_ZERO_HID_REPO_RESOURCES_DIR="${CURRENT_DIR}/web"

HA_ZERO_HID_CLIENT_COMPONENT_NAME="ha_zero_hid"
HA_ZERO_HID_CLIENT_RESOURCES_DIR_NAME="ha-zero-hid"
HA_ZERO_HID_CLIENT_RESOURCES_VERSION=$(date +%Y%m%d%H%M%S)$(awk -F. '{printf "%03d", $2/1000}' /proc/uptime)
HA_ZERO_HID_CLIENT_COMPONENT_LABEL="HA zero HID"

HA_ZERO_HID_CLIENT_CONFIG_FILE="${HAOS_CONFIG_DIR}/${HA_ZERO_HID_CLIENT_COMPONENT_NAME}.config"

HA_ZERO_HID_CLIENT_COMPONENT_DIR="${HAOS_CUSTOM_COMPONENTS_DIR}/${HA_ZERO_HID_CLIENT_COMPONENT_NAME}"
HA_ZERO_HID_CLIENT_COMPONENT_INIT_FILE="${HA_ZERO_HID_CLIENT_COMPONENT_DIR}/__init__.py"
HA_ZERO_HID_CLIENT_COMPONENT_CONST_FILE="${HA_ZERO_HID_CLIENT_COMPONENT_DIR}/const.py"
HA_ZERO_HID_CLIENT_COMPONENT_MANIFEST_FILE="${HA_ZERO_HID_CLIENT_COMPONENT_DIR}/manifest.json"
HA_ZERO_HID_CLIENT_COMPONENT_VERSION_FILE="${HA_ZERO_HID_CLIENT_COMPONENT_DIR}/version"

HA_ZERO_HID_CLIENT_RESOURCES_DIR="${HAOS_RESOURCES_DIR}/${HA_ZERO_HID_CLIENT_RESOURCES_DIR_NAME}"
HA_ZERO_HID_CLIENT_RESOURCES_REMOTE_CARD_FILE="${HA_ZERO_HID_CLIENT_RESOURCES_DIR}/android-remote-card.js"
HA_ZERO_HID_CLIENT_RESOURCES_UTILS_DIR="${HA_ZERO_HID_CLIENT_RESOURCES_DIR}/utils"
HA_ZERO_HID_CLIENT_RESOURCES_GLOBALS_FILE="${HA_ZERO_HID_CLIENT_RESOURCES_UTILS_DIR}/globals.js"
HA_ZERO_HID_CLIENT_RESOURCES_KEYCODES_FILE="${HA_ZERO_HID_CLIENT_RESOURCES_UTILS_DIR}/keycodes.js"
HA_ZERO_HID_CLIENT_RESOURCES_CONSUMERCODES_FILE="${HA_ZERO_HID_CLIENT_RESOURCES_UTILS_DIR}/consumercodes.js"

# Clean-up:
# - component from HAOS config (yaml)
# - component resources (py, ...)
# - web resources (js, html, css, svg, ...)
# - component dedicated config (config)
# - dependencies (zero-hid repository)
cleanup() {
    local should_delete_config="$1"

    # Cleaning up component custom config file when explicitely required
    if [ "${should_delete_config}" == "true" ]; then
      echo "Cleaning ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} config file (${HA_ZERO_HID_CLIENT_CONFIG_FILE})..."
      rm "${HA_ZERO_HID_CLIENT_CONFIG_FILE}" >/dev/null 2>&1 || true
    else
      mv "${HA_ZERO_HID_CLIENT_RESOURCES_KEYCODES_FILE}" "./keycodes.js.bak"
      mv "${HA_ZERO_HID_CLIENT_RESOURCES_KEYCODES_FILE}.sum" "./keycodes.js.sum.bak"
      mv "${HA_ZERO_HID_CLIENT_RESOURCES_CONSUMERCODES_FILE}" "./consumercodes.js.bak"
      mv "${HA_ZERO_HID_CLIENT_RESOURCES_CONSUMERCODES_FILE}.sum" "./consumercodes.js.sum.bak"
    fi

    # Unregister component from HAOS configuration to disable it
    echo "Unregistering ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} from HAOS configuration (${HAOS_CONFIG_FILE})..."
    sed -i "/^${HA_ZERO_HID_CLIENT_COMPONENT_NAME}:$/d" "${HAOS_CONFIG_FILE}"
    
    # Cleaning up component python resources (py)
    echo "Cleaning ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} component files (${HA_ZERO_HID_CLIENT_COMPONENT_DIR})..."
    rm -rf "${HA_ZERO_HID_CLIENT_COMPONENT_DIR}" >/dev/null 2>&1 || true

    # Cleaning existing web resources when existing
    echo "Cleaning ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} web resources files (${HA_ZERO_HID_CLIENT_RESOURCES_DIR})..."
    rm -rf "${HA_ZERO_HID_CLIENT_RESOURCES_DIR}" >/dev/null 2>&1 || true

    # Cleaning up component dependencies
    echo "Cleaning ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} zero-hid dependency (${ZERO_HID_REPO_DIR})..."
    rm -rf "${ZERO_HID_REPO_DIR}" >/dev/null 2>&1 || true
    
    # Restoring files to keep
    if [ "${should_delete_config}" == "true" ]; then
      echo "All files deleted"
    else
      mkdir -p "${HA_ZERO_HID_CLIENT_RESOURCES_UTILS_DIR}"
      mv "./keycodes.js.bak" "${HA_ZERO_HID_CLIENT_RESOURCES_KEYCODES_FILE}"
      mv "./keycodes.js.sum.bak" "${HA_ZERO_HID_CLIENT_RESOURCES_KEYCODES_FILE}.sum"
      mv "./consumercodes.js.bak" "${HA_ZERO_HID_CLIENT_RESOURCES_CONSUMERCODES_FILE}"
      mv "./consumercodes.js.sum.bak" "${HA_ZERO_HID_CLIENT_RESOURCES_CONSUMERCODES_FILE}.sum"
      echo "Config and static files preserved"
    fi
}

# Updates component to latest GIT available version of specified branch (or default branch when not specified)
update() {
    local REMOTE_BRANCH="$1"
    local REMOTE_NAME="origin"
    local LOCAL_BRANCH="$REMOTE_BRANCH"
    local LOCAL_REPO_ROOT="$(git rev-parse --show-toplevel)"

    # Fetch latest info from remote
    git -C "$LOCAL_REPO_ROOT" fetch -a --prune "$REMOTE_NAME"

    # If no branch specified, get default remote branch
    if [ -z "$REMOTE_BRANCH" ]; then
      REMOTE_BRANCH=$(git -C "$LOCAL_REPO_ROOT" symbolic-ref refs/remotes/$REMOTE_NAME/HEAD | sed "s@refs/remotes/$REMOTE_NAME/@@")
      echo "No branch specified. Using default remote branch: $REMOTE_BRANCH"
    else
      echo "Target remote branch: $REMOTE_BRANCH"
    fi

    # Check if local branch exists
    if git -C "$LOCAL_REPO_ROOT" show-ref --verify --quiet refs/heads/"$LOCAL_BRANCH"; then
      echo "Local branch '$LOCAL_BRANCH' exists. Checking it out."
      git -C "$LOCAL_REPO_ROOT" checkout "$LOCAL_BRANCH"
    else
      echo "Local branch '$LOCAL_BRANCH' doesn't exist. Creating and tracking '$REMOTE_NAME/$REMOTE_BRANCH'."
      git -C "$LOCAL_REPO_ROOT" checkout -b "$LOCAL_BRANCH" --track "$REMOTE_NAME/$REMOTE_BRANCH"
    fi

    # Hard reset local branch to remote branch (discard all local changes)
    echo "Resetting local branch '$LOCAL_BRANCH' to '$REMOTE_NAME/$REMOTE_BRANCH'..."
    git -C "$LOCAL_REPO_ROOT" reset --hard "$REMOTE_NAME/$REMOTE_BRANCH"

    # Clean untracked files (including ignored files)
    git -C "$LOCAL_REPO_ROOT" clean -xfd

    echo "Local branch '$LOCAL_BRANCH' is now clean and matches '$REMOTE_NAME/$REMOTE_BRANCH'"
}

copy_dir_content() {
    local SRC_DIR_PATH="${1}"
    local DST_DIR_PATH="${2}"

    shopt -s dotglob
    cp -R "${SRC_DIR_PATH}"/* "${DST_DIR_PATH}"
    shopt -u dotglob
}

extract_keycodes_to_js_class() {
    local INPUT_PYTHON_FILE="$1"
    local OUTPUT_JS_FILE="$2"
    local OUTPUT_JS_CLASS="$3"

    if [[ ! -f "${INPUT_PYTHON_FILE}" ]]; then
        echo "Input file not found: ${INPUT_PYTHON_FILE}"
        return 1
    fi
    
    # Compute new hash
    local new_hash=$(cksum "${INPUT_PYTHON_FILE}")
    
    # When output file already exists, check whether or not regeneration is needed
    if [[ -f "${OUTPUT_JS_FILE}" ]]; then
        echo "Output file already exists: ${OUTPUT_JS_FILE}. Checking if regeneration is needed..."
        if [[ -f "${OUTPUT_JS_FILE}.sum" ]]; then
            echo "Checksum file already exists: ${OUTPUT_JS_FILE}.sum. Checking if regeneration is needed..."

            # Retrieve old hash
            local old_hash=$(<"${OUTPUT_JS_FILE}.sum")

            # Compare the two
            if [ "$old_hash" = "$new_hash" ]; then
              echo "Existing file did not changed. Skipping generation from ${INPUT_PYTHON_FILE}."
              return 0
            fi
        else
            echo "Checksum file not found: ${OUTPUT_JS_FILE}.sum. Regenerating..."
        fi
        echo "Output file not found: ${OUTPUT_JS_FILE}. Regenerating..."
    fi

    echo "Generation of ${OUTPUT_JS_FILE} needed: writing new hash into file ${OUTPUT_JS_FILE}.sum..."
    echo -n "$new_hash" > "${OUTPUT_JS_FILE}.sum"

    echo "Generation of ${OUTPUT_JS_FILE} needed: regenerating from ${INPUT_PYTHON_FILE}..."
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

create_server_config() {
    local CONFIG_JSON="$1"
    local websocket_server_id=$(jq -r '
      if (.servers | type == "array") and (.servers | length > 0) then
        [.servers[].id | select(.) | tonumber] | if length == 0 then "1" else ((max + 1) | tostring) end
      else
        "1"
      end
    ' ${CONFIG_JSON})

    # Manual setup of "websocket_server_name":
    regex='^.+$'
    while true; do
        read -p "Server ${websocket_server_id}: enter server friendly name (ex: livingroom): " websocket_server_name </dev/tty
        websocket_server_name=$(echo "$websocket_server_name" | xargs) # Trims whitespace
        if [[ ${websocket_server_name} =~ ${regex} ]]; then
            break
        else
            echo "Please answer a well-formed friendly name (non-empty and non-whitespaces-only expected)"
        fi
    done

    # Manual setup of "websocket_server_protocol":
    regex='^(wss|ws)$'
    while true; do
        read -p "Server ${websocket_server_id}: enter server websockets protocol (wss or ws): " websocket_server_protocol </dev/tty
        websocket_server_protocol=$(echo "$websocket_server_protocol" | xargs) # Trims whitespace
        if [[ ${websocket_server_protocol} =~ ${regex} ]]; then
            break
        else
            echo "Please answer a well-formed server websockets protocol (wss or ws expected)"
        fi
    done

    # Manual setup of "websocket_server_ip":
    regex='^((25[0-5]|(2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9]))\.){3}(25[0-5]|(2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9]))$'
    while true; do
        read -p "Server ${websocket_server_id}: enter USB gadget IPv4 address (ex: 192.168.1.15): " websocket_server_ip </dev/tty
        websocket_server_ip=$(echo "$websocket_server_ip" | xargs) # Trims whitespace
        if [[ ${websocket_server_ip} =~ ${regex} ]]; then
            break
        else
            echo "Please answer a well-formed IPv4 address (vvv.xxx.yyy.zzz expected, where 0 <= vvv <= 255, etc)"
        fi
    done

    # Manual setup of "websocket_server_port":
    regex='^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$'
    while true; do
        read -p "Server ${websocket_server_id}: enter USB gadget websockets port (default: 8765): " websocket_server_port </dev/tty
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

    # Manual setup of "websocket_server_secret":
    regex='^.+$'
    while true; do
        read -p "Server ${websocket_server_id}: enter HA-ZERO-HID server secret (ex: myServerSecret): " websocket_server_secret </dev/tty
        websocket_server_secret=$(echo "$websocket_server_secret" | xargs) # Trims whitespace
        if [[ "$websocket_server_secret" =~ $regex ]]; then
            break
        else
            echo "Please answer a well-formed secret (non-empty and non-whitespaces-only expected)"
        fi
    done

    # Manual setup of "websocket_authorized_users_ids":
    regex='^ *[^ ]* *(, *[^ ]* *)* *$'
    while true; do

        # Display existing users
        /bin/bash user_activity_report.sh

        read -p "Server ${websocket_server_id}: enter list of authorized users ids (ex: userid_1,..,userid_n): " websocket_authorized_users_ids </dev/tty
        websocket_authorized_users_ids=$(echo "$websocket_authorized_users_ids" | xargs) # Trims whitespace
        if [[ "$websocket_authorized_users_ids" =~ $regex ]]; then
            break
        else
            echo "Please answer a well-formed list of authorized users id (userid_1,..,userid_n expected)"
        fi
    done

    # Write updated config file (id, name, protocol, host, port, secret, authorized_users)
    tmp_file="${HA_ZERO_HID_CLIENT_RESOURCES_VERSION}_tmp"
    jq ".servers += [{\"id\": \"${websocket_server_id}\"}]" "${CONFIG_JSON}" > "${tmp_file}" && mv "${tmp_file}" "${CONFIG_JSON}"
    jq "(.servers[] | select(.id == \"${websocket_server_id}\")) += {\"name\": \"${websocket_server_name}\"}" "${CONFIG_JSON}" > "${tmp_file}" && mv "${tmp_file}" "${CONFIG_JSON}"
    jq "(.servers[] | select(.id == \"${websocket_server_id}\")) += {\"protocol\": \"${websocket_server_protocol}\"}" "${CONFIG_JSON}" > "${tmp_file}" && mv "${tmp_file}" "${CONFIG_JSON}"
    jq "(.servers[] | select(.id == \"${websocket_server_id}\")) += {\"host\": \"${websocket_server_ip}\"}" "${CONFIG_JSON}" > "${tmp_file}" && mv "${tmp_file}" "${CONFIG_JSON}"
    jq "(.servers[] | select(.id == \"${websocket_server_id}\")) += {\"port\": \"${websocket_server_port}\"}" "${CONFIG_JSON}" > "${tmp_file}" && mv "${tmp_file}" "${CONFIG_JSON}"
    jq "(.servers[] | select(.id == \"${websocket_server_id}\")) += {\"secret\": \"${websocket_server_secret}\"}" "${CONFIG_JSON}" > "${tmp_file}" && mv "${tmp_file}" "${CONFIG_JSON}"
    jq "(.servers[] | select(.id == \"${websocket_server_id}\")) += {\"authorized_users\": \"${websocket_authorized_users_ids}\"}" "${CONFIG_JSON}" > "${tmp_file}" && mv "${tmp_file}" "${CONFIG_JSON}"
    rm "${tmp_file}"
}

install() {
    # ------------------
    # Installing raw components files
    # ------------------
    
    # Installing raw client component files
    echo "Installing ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} client component..."
    mkdir -p "${HA_ZERO_HID_CLIENT_COMPONENT_DIR}"
    copy_dir_content "${HA_ZERO_HID_REPO_COMPONENT_DIR}" "${HA_ZERO_HID_CLIENT_COMPONENT_DIR}"

    # Installing raw client web resources
    echo "Installing ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} client web resources..."
    mkdir -p "${HA_ZERO_HID_CLIENT_RESOURCES_DIR}"
    copy_dir_content "${HA_ZERO_HID_REPO_RESOURCES_DIR}" "${HA_ZERO_HID_CLIENT_RESOURCES_DIR}"

    echo "Cloning zero-hid repository at ${ZERO_HID_REPO_URL}, on branch ${ZERO_HID_REPO_BRANCH}..."
    git clone -b "${ZERO_HID_REPO_BRANCH}" "${ZERO_HID_REPO_URL}"

    echo "Installing web keyboard codes mapping at ${HA_ZERO_HID_CLIENT_RESOURCES_KEYCODES_FILE}..."
    extract_keycodes_to_js_class "${ZERO_HID_REPO_DIR}/zero_hid/hid/keycodes.py" "${HA_ZERO_HID_CLIENT_RESOURCES_KEYCODES_FILE}" "KeyCodes"

    echo "Installing web consumer codes mapping at ${HA_ZERO_HID_CLIENT_RESOURCES_CONSUMERCODES_FILE}..."
    extract_keycodes_to_js_class "${ZERO_HID_REPO_DIR}/zero_hid/hid/consumercodes.py" "${HA_ZERO_HID_CLIENT_RESOURCES_CONSUMERCODES_FILE}" "ConsumerCodes"

    # ------------------
    # Retrieving configs
    # ------------------

    # Config valid flags
    websocket_servers_config_valid=false

    # Automatic setup : try loading config file
    if [ -f "${HA_ZERO_HID_CLIENT_CONFIG_FILE}" ]; then
        # Config file found: validate JSON format

        # Validate "servers" exists and is an array
        if ! jq -e '.servers | type == "array"' "${HA_ZERO_HID_CLIENT_CONFIG_FILE}" > /dev/null; then
            echo "Error: 'servers' must be an array in config.json"
        else
            # Validate each "server" entry has required fields (id, name, protocol)
            if ! jq -e '.servers[] | select(has("id") and has("name") and has("protocol") and has("host") and has("port") and has("secret") and has("authorized_users"))' "${HA_ZERO_HID_CLIENT_CONFIG_FILE}" > /dev/null; then
                echo "Error: One or more server entries are missing from 'servers' array in config.json are missing required fields (id, name, protocol, host, port, secret, authorized_users)"
            else
                # Config is valid
                websocket_servers_config_valid=true
            fi
        fi
    fi

    # Invalid or missing config: will need to ask user for a correct config dynamically
    if [ "${websocket_servers_config_valid}" != "true" ]; then

        # Automatic setup : no config file or config file not accessible
        echo "Config file not found or invalid: ${HA_ZERO_HID_CLIENT_CONFIG_FILE}"

        # Initialize File with Empty Array
        echo "Initializing a new config file at ${HA_ZERO_HID_CLIENT_CONFIG_FILE}..."
        echo '{ "servers": [] }' > "${HA_ZERO_HID_CLIENT_CONFIG_FILE}"

        create_server_config "${HA_ZERO_HID_CLIENT_CONFIG_FILE}"
    fi

    # Convert JSON to Python-style syntax using jq only
    servers_py=$(jq -r '
      .servers 
      | map("{\"id\": \"\(.id)\", \"name\": \"\(.name)\", \"protocol\": \"\(.protocol)\", \"host\": \"\(.host)\", \"port\": \(.port), \"secret\": \"\(.secret)\", \"authorized_users\": \"\(.authorized_users)\"}") 
      | "[" + join(", ") + "]"
    ' "${HA_ZERO_HID_CLIENT_CONFIG_FILE}")

    # ------------------
    # Templating raw component files
    # ------------------

    # Templating client component raw files with configurations
    echo "Configuring ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} client component..."

    echo "Templating ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} component name and ${HA_ZERO_HID_CLIENT_COMPONENT_LABEL} component label into component manifest ${HA_ZERO_HID_CLIENT_COMPONENT_MANIFEST_FILE}..."
    sed -i "s|<ha_component_name>|${HA_ZERO_HID_CLIENT_COMPONENT_NAME}|g" "${HA_ZERO_HID_CLIENT_COMPONENT_MANIFEST_FILE}"
    sed -i "s|<ha_component_label>|${HA_ZERO_HID_CLIENT_COMPONENT_LABEL}|g" "${HA_ZERO_HID_CLIENT_COMPONENT_MANIFEST_FILE}"

    echo "Templating ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} component resources directory name to ${HA_ZERO_HID_CLIENT_RESOURCES_DIR_NAME} into component ${HA_ZERO_HID_CLIENT_COMPONENT_CONST_FILE}..."
    sed -i "s|<ha_resources_domain>|${HA_ZERO_HID_CLIENT_RESOURCES_DIR_NAME}|g" "${HA_ZERO_HID_CLIENT_COMPONENT_CONST_FILE}"

    echo "Templating ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} component resources version to ${HA_ZERO_HID_CLIENT_RESOURCES_VERSION} into component ${HA_ZERO_HID_CLIENT_COMPONENT_CONST_FILE}..."
    sed -i "s|<ha_resources_version>|${HA_ZERO_HID_CLIENT_RESOURCES_VERSION}|g" "${HA_ZERO_HID_CLIENT_COMPONENT_CONST_FILE}"

    echo "Templating ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} component servers into component global Python constants ${HA_ZERO_HID_CLIENT_COMPONENT_CONST_FILE}..."
    sed -i "s|<servers>|${servers_py}|g" "${HA_ZERO_HID_CLIENT_COMPONENT_CONST_FILE}"

    # Templating client component raw files with configurations
    echo "Configuring ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} client web resources..."

    echo "Templating ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} component resources version to ${HA_ZERO_HID_CLIENT_RESOURCES_VERSION} into compound card ${HA_ZERO_HID_CLIENT_RESOURCES_REMOTE_CARD_FILE}..."
    sed -i "s|<ha_resources_version>|${HA_ZERO_HID_CLIENT_RESOURCES_VERSION}|g" "${HA_ZERO_HID_CLIENT_RESOURCES_REMOTE_CARD_FILE}"

    echo "Templating ${HA_ZERO_HID_CLIENT_COMPONENT_NAME} name into ${HA_ZERO_HID_CLIENT_RESOURCES_GLOBALS_FILE}..."
    sed -i "s|<ha_component_name>|${HA_ZERO_HID_CLIENT_COMPONENT_NAME}|g" "${HA_ZERO_HID_CLIENT_RESOURCES_GLOBALS_FILE}"

    echo "Templating ${HA_ZERO_HID_CLIENT_RESOURCES_DIR_NAME} resources directory name into ${HA_ZERO_HID_CLIENT_RESOURCES_GLOBALS_FILE}..."
    sed -i "s|<ha_resources_domain>|${HA_ZERO_HID_CLIENT_RESOURCES_DIR_NAME}|g" "${HA_ZERO_HID_CLIENT_RESOURCES_GLOBALS_FILE}"

    echo "Templating ${HA_ZERO_HID_CLIENT_RESOURCES_VERSION} resources version into ${HA_ZERO_HID_CLIENT_RESOURCES_GLOBALS_FILE}..."
    sed -i "s|<ha_resources_version>|${HA_ZERO_HID_CLIENT_RESOURCES_VERSION}|g" "${HA_ZERO_HID_CLIENT_RESOURCES_GLOBALS_FILE}"

    # Update system and install dependencies
    echo "Dev mode: ${ENABLE_DEV_MODE}"
    if [ -z "${ENABLE_DEV_MODE}" ]; then
        echo "Restart Home Assistant now to fully apply the update"
    else
        echo "Version set to ${HA_ZERO_HID_CLIENT_RESOURCES_VERSION} into version file ${HA_ZERO_HID_CLIENT_COMPONENT_VERSION_FILE}: frontend web resources will be soon reloaded without needing a restart (restart is still required to reload the component backend python code)..."
        echo -n "${HA_ZERO_HID_CLIENT_RESOURCES_VERSION}" > "${HA_ZERO_HID_CLIENT_COMPONENT_VERSION_FILE}"
    fi

    # Register client component into HAOS config to enable it
    grep -qxF "${HA_ZERO_HID_CLIENT_COMPONENT_NAME}:" "${HAOS_CONFIG_FILE}" || echo "${HA_ZERO_HID_CLIENT_COMPONENT_NAME}:" >> "${HAOS_CONFIG_FILE}"
}

uninstall () {
    local INTERACTIVE="${1:-}"
    delete_component_conf_file=false

    if [ -z "${INTERACTIVE}" ]; then
      if [ -f "${HA_ZERO_HID_CLIENT_CONFIG_FILE}" ]; then
          read -rp "Keep integration config? (y/n) " confirm </dev/tty
          case "$confirm" in
              [Yy]* )
                  echo "Config file will not be deleted (${HA_ZERO_HID_CLIENT_CONFIG_FILE})"
                  ;;
              [Nn]* )
                  echo "Config file will be deleted (${HA_ZERO_HID_CLIENT_CONFIG_FILE})"
                  delete_component_conf_file=true
                  ;;
              * )
                  echo "Please answer y or n."
                  exit 1
                  ;;
          esac
      fi
    fi
    
    # Effective removal
    cleanup "${delete_component_conf_file}"
}

if [ -d "${HA_ZERO_HID_CLIENT_COMPONENT_DIR}" ]; then
    echo "Looks like HA zero-hid client integration is already installed"
    if [ -z "${ENABLE_AUTO_MODE}" ]; then
        echo "Please choose an option:"
        echo "  1) Update & reinstall (auto)"
        echo "  2) Update & reinstall (interactive)"
        echo "  3) Uninstall (interactive)"
        echo "  4) Exit"
        read -rp "Enter choice [1-4]: " choice </dev/tty
        
        case "$choice" in
            1)
                echo "Updating & reinstalling (auto)"
                uninstall "NON_INTERACTIVE"
                update "${ZERO_HID_REPO_BRANCH}"
                install
                echo "Updated & reinstalled HA zero-hid client integration (auto)."
                exit 0
                ;;
            2)
                read -rp "Are you sure you want to reinstall or update? (y/n) " confirm </dev/tty
                case "$confirm" in
                    [Yy]* )
                        echo "Updating & reinstalling (auto)..."
                        uninstall
                        update "${ZERO_HID_REPO_BRANCH}"
                        install
                        echo "Updated & reinstalled HA zero-hid client integration (interactive)."
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
                read -rp "Are you sure you want to uninstall? (y/n) " confirm </dev/tty
                case "$confirm" in
                    [Yy]* )
                        echo "Uninstalling..."
                        uninstall
                        echo "Uninstalled HA zero-hid client integration (interactive)."
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
            4)
                echo "Exiting script."
                exit 0
                ;;
            *)
                echo "Invalid choice, exiting."
                exit 1
                ;;
        esac
    else
        echo "Interactive mode disabled"
        echo "Updating & reinstalling (auto)"
        uninstall "NON_INTERACTIVE"
        update "${ZERO_HID_REPO_BRANCH}"
        install
        echo "Updated & reinstalled HA zero-hid client integration (auto)."
        exit 0
    fi
else
    echo "First install of HA zero-hid client integration"
    echo "Installing (interactive)..."
    install
    echo "Installed HA zero-hid client integration (interactive)."
fi
