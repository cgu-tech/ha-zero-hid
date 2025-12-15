#!/bin/bash
TIMESTAMP=$(date +%Y%m%d%H%M%S)$(awk -F. '{printf "%03d", $2/1000}' /proc/uptime)
CURRENT_DIR="$(pwd)"

# Function to ensure specified path points to an existing file
ensure_file_exists() {
  local file="$1"
  mkdir -p "$(dirname "$file")"
  touch "$file"
}

# Function to search YAML pattern in file
search_yaml_block() {
  local file="$1"
  local type="$2"
  local unique_id="$3"

  local inside_block=0
  local block_matches=0

  # Prebuild regex for block start
  local block_start_regex="^-[[:space:]]*$type:"

  # Prebuild regex for unique_id line
  local unique_id_regex="^[[:space:]]*- unique_id:[[:space:]]*${unique_id}$"

  while IFS= read -r line || [[ -n "$line" ]]; do

    if [[ $inside_block -eq 0 ]]; then
      #echo "Not inside a block, check if line starts the block [$line]"
      if [[ $line =~ $block_start_regex ]]; then
        #echo "Triggered inside a block [$line]"
        inside_block=1
        block_matches=0
      fi

    else
      #echo "Inside block, check for unique_id line [$line]"

      if [[ $line =~ $unique_id_regex ]]; then
        #echo "Triggered matching unique_id [$line]"
        block_matches=1
      fi

      #echo "Detect end of block by new top-level entry or EOF [$line]"
      # New top-level block starts at beginning of line (col 0)
      if [[ $line =~ ^-[[:space:]]+[a-zA-Z0-9_]+: ]] && [[ ! $line =~ ^[[:space:]] ]]; then
        #echo "New top-level block started, stop current block [$line]"
        if [[ $block_matches -eq 1 ]]; then
          #echo "Found the matching block before new block [$line]"
          return 0
        fi
        inside_block=0
        block_matches=0
      fi
    fi

  done < "$file"

  #echo "Reached EOF"
  if [[ $inside_block -eq 1 && $block_matches -eq 1 ]]; then
    #echo "EOF reached while inside block with match"
    return 0
  fi

  #echo "No matching block found"
  return 1
}


remove_yaml_block() {
  local file="$1"
  local type="$2"       # e.g. light
  local unique_id="$3"  # e.g. disney_castle_light

  local tmpfile
  tmpfile="$(mktemp)"

  local inside_block=0
  local block_matches=0
  local buffer=()

  # Helper: print buffer content
  print_buffer() {
    for l in "${buffer[@]}"; do
      echo "$l"
    done
    buffer=()
  }

  while IFS= read -r line || [[ -n "$line" ]]; do

    if [[ $inside_block -eq 0 ]]; then
      # Not inside block, check if this line starts the block
      if [[ $line =~ ^[[:space:]]*-[[:space:]]*$type: ]]; then
        # Start buffering block
        inside_block=1
        block_matches=0
        buffer=("$line")
      else
        # Normal line, print it immediately
        echo "$line" >> "$tmpfile"
      fi

    else
      # Inside block, buffer the line
      buffer+=("$line")

      # Check if line matches unique_id line
      if [[ $line =~ ^[[:space:]]*unique_id:[[:space:]]*$unique_id ]]; then
        block_matches=1
      fi

      # Check if next line is a new top-level entry, which ends the block
      if [[ $line =~ ^[[:space:]]*-[[:space:]]+[a-zA-Z0-9_]+: ]] && [[ "${buffer[-1]}" != "$line" ]]; then
        # The block ended on previous line (because current line is new block)
        # But since we already buffered this line, we must remove last line from buffer and process it separately
        last_line="${buffer[-1]}"
        unset 'buffer[-1]'

        if [[ $block_matches -eq 1 ]]; then
          # matched block => delete it, do NOT print buffer
          # print current line as new block start
          echo "$last_line" >> "$tmpfile"
        else
          # not matched, print buffer and current line
          print_buffer >> "$tmpfile"
          echo "$last_line" >> "$tmpfile"
        fi
        inside_block=0
        block_matches=0
        buffer=()
      fi

    fi

  done < "$file"

  # End of file reached, if inside block
  if [[ $inside_block -eq 1 ]]; then
    if [[ $block_matches -eq 0 ]]; then
      print_buffer >> "$tmpfile"
    fi
  fi

  mv "$tmpfile" "$file"
}

remove_yaml_subblock() {
  local file="$1"
  local unique_id="$2"

  awk -v uid="$unique_id" '
  function leading_spaces(line) {
    match(line, /^[ \t]*/)
    return RLENGTH
  }

  BEGIN {
    skip=0
    skip_indent=-1
  }

  {
    # If currently skipping lines belonging to the target unique_id block
    if (skip == 1) {
      cur_indent = leading_spaces($0)

      # Stop skipping when encountering new top-level item (starts with "- ")
      if ($0 ~ /^[ \t]*-[ \t]+/) {
        skip=0
        skip_indent=-1
      } else {
        next
      }
    }

    # Trim leading spaces for matching
    line_trim = $0
    gsub(/^[ \t]+/, "", line_trim)
    gsub(/[ \t]+$/, "", line_trim)

    # Match line like "- unique_id: my_light" or "unique_id: my_light"
    if (line_trim ~ ("^-?[ \t]*unique_id:[ \t]*" uid "$")) {
      skip=1
      skip_indent = leading_spaces($0)
      next
    }

    print $0
  }
  ' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
}


remove_yaml_top_level_block() {
  local file="$1"
  local block_name="$2"

  echo "Removing block '${block_name}' from '${file}'"

  awk -v block="$block_name" '
    BEGIN {
      skip=0
      block_regex = "^[[:space:]]*" block ":"
      # print "DEBUG: Looking for block \"" block "\" in file" > "/dev/stderr"
    }
    {
      if (skip) {
        if ($0 ~ /^[[:space:]]+/) {
          # print "DEBUG: Skipping line inside block: " $0 > "/dev/stderr"
          next
        } else {
          # print "DEBUG: Block ended before line: " $0 > "/dev/stderr"
          skip=0
        }
      }
      if (!skip && $0 ~ block_regex) {
        # print "DEBUG: Found block start: " $0 > "/dev/stderr"
        skip=1
        next
      }
      if (!skip) {
        print $0
      }
    }
  ' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"

  #echo "Done removing '${block_name}' from '${file}'"
}

# First function: converts 2-digit hex to decimal
hex_to_dec() {
    local hex="$1"
    local __resultvar="$2"
    local dec=0
    local i
    local digit
    hex="${hex^^}"  # Convert to uppercase

    for (( i=0; i<${#hex}; i++ )); do
        digit="${hex:i:1}"
        case "$digit" in
            [0-9]) digit=$((digit)) ;;
            A) digit=10 ;;
            B) digit=11 ;;
            C) digit=12 ;;
            D) digit=13 ;;
            E) digit=14 ;;
            F) digit=15 ;;
            *) echo "Invalid hex: $hex" >&2; return 1 ;;
        esac
        dec=$((dec * 16 + digit))
    done

    # Assign to external variable
    if [[ -n "$__resultvar" ]]; then
        eval "$__resultvar=$dec"
    else
        echo "$dec"
    fi
}

# Second function: converts #RRGGBB into three decimal values
hex_to_rgb() {
    local hex="$1"
    local __rvar="$2"
    local __gvar="$3"
    local __bvar="$4"

    # Remove leading '#' if present
    hex="${hex#\#}"

    # Validate length
    if [[ ${#hex} -ne 6 ]]; then
        echo "Invalid hex color: $1" >&2
        return 1
    fi

    # Extract RR, GG, BB
    local rr="${hex:0:2}"
    local gg="${hex:2:2}"
    local bb="${hex:4:2}"

    # Convert each to decimal
    hex_to_dec "$rr" "$__rvar"
    hex_to_dec "$gg" "$__gvar"
    hex_to_dec "$bb" "$__bvar"
}

# Convert a decimal (0-255) to 2-digit uppercase hex
dec_to_hex() {
    local dec=$1
    local __resultvar=$2

    # Validate input
    if [[ $dec -lt 0 || $dec -gt 255 ]]; then
        echo "Invalid decimal: $dec (must be 0-255)" >&2
        return 1
    fi

    local hex_digits=(0 1 2 3 4 5 6 7 8 9 A B C D E F)
    local high=$((dec / 16))
    local low=$((dec % 16))
    local hex="${hex_digits[high]}${hex_digits[low]}"

    if [[ -n "$__resultvar" ]]; then
        eval "$__resultvar=\"$hex\""
    else
        echo "$hex"
    fi
}

# Convert three decimals (R,G,B) to #RRGGBB string
rgb_to_hex() {
    local r=$1
    local g=$2
    local b=$3
    local __resultvar=$4
    local hr hg hb hex

    dec_to_hex "$r" hr
    dec_to_hex "$g" hg
    dec_to_hex "$b" hb

    hex="#${hr}${hg}${hb}"

    if [[ -n "$__resultvar" ]]; then
        eval "$__resultvar=\"$hex\""
    else
        echo "$hex"
    fi
}

# Indexed arrays to hold keys, values and displays
CONFIG_KEYS=()
CONFIG_VALUES=()
CONFIG_DISPLAYS=()

load_config_map() {
  local file="$1"
  local key value display line line_num=0

  if [[ ! -f "$file" ]]; then
    echo "ERROR: File not found: $file" >&2
    return 1
  fi

  while IFS=',' read -r key value display; do
    line_num=$((line_num + 1))

    # Skip comments and empty lines
    [[ -z "$key" || "$key" == \#* ]] && continue

    # Trim whitespace and remove optional surrounding quotes
    key=$(echo "$key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//')
    value=$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//')
    # If display is missing, default to empty string
    if [[ -z "$display" ]]; then
      display=""
    else
      display=$(echo "$display" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//')
    fi

    CONFIG_KEYS+=("$key")
    CONFIG_VALUES+=("$value")
    CONFIG_DISPLAYS+=("$display")
  done < "$file"
}

check_required_keys() {
  local required_keys=("$@")
  local missing=()
  local key found

  for key in "${required_keys[@]}"; do
    found=0
    for existing_key in "${CONFIG_KEYS[@]}"; do
      if [[ "$existing_key" == "$key" ]]; then
        found=1
        break
      fi
    done
    if [[ $found -eq 0 ]]; then
      missing+=("$key")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "ERROR: Missing required keys: ${missing[*]}" >&2
    return 1
  fi

  return 0
}

get_value_for_key() {
  local search_key="$1"
  local i

  for i in "${!CONFIG_KEYS[@]}"; do
    if [[ "${CONFIG_KEYS[i]}" == "$search_key" ]]; then
      echo "${CONFIG_VALUES[i]}"
      return 0
    fi
  done

  # Return empty if not found (or you can return an error code)
  return 1
}

get_display_for_key() {
  local search_key="$1"
  local i

  for i in "${!CONFIG_KEYS[@]}"; do
    if [[ "${CONFIG_KEYS[i]}" == "$search_key" ]]; then
      echo "${CONFIG_DISPLAYS[i]}"
      return 0
    fi
  done

  # Return empty if not found (or you can return an error code)
  return 1
}

get_keys_starting_with() {
  local prefix="$1"
  local i
  local matched_keys=()

  for i in "${!CONFIG_KEYS[@]}"; do
    if [[ "${CONFIG_KEYS[i]}" == "$prefix"* ]]; then
      matched_keys+=("${CONFIG_KEYS[i]}")
    fi
  done

  # Print all matched keys separated by newlines
  for key in "${matched_keys[@]}"; do
    echo "$key"
  done
}

ask_confirm() {
  local prompt="$1"
  local answer

  while true; do
    read -rp "$prompt (y/n): " answer
    case "$answer" in
      [Yy]) return 0 ;;  # yes
      [Nn]) return 1 ;;  # no
      *) echo "Please answer y or n." ;;
    esac
  done
}

########
# MAIN #
########

# Parameters (from command-line args, if provided)
ENTITY_CONFIG_FILE="${1:-}"

# Prompt until ENTITY_CONFIG_FILE is filled
while [ -z "$ENTITY_CONFIG_FILE" ]; do
  read -rp "Enter the CSV file path that contains entity configurations (e.g., illuminated_brick_game.csv): " ENTITY_CONFIG_FILE
done

echo "Loading CSV file that contains entity configurations..."
load_config_map "${ENTITY_CONFIG_FILE}"

echo "Checking required keys from loaded CSV file..."
required=("ENTITY_TYPE" "ENTITY_ID" "ENTITY_NAME" "POWER_ON_SCRIPT" "POWER_OFF_SCRIPT")
if ! check_required_keys "${required[@]}"; then
  echo "Missing keys. Exiting."
  exit 1
fi
echo "All required keys found! ($required)"

echo "Retrieving required values..."
ENTITY_TYPE=$(get_value_for_key "ENTITY_TYPE")
ENTITY_ID=$(get_value_for_key "ENTITY_ID")
ENTITY_NAME=$(get_value_for_key "ENTITY_NAME")
ENTITY_POWER_ON_SCRIPT=$(get_value_for_key "POWER_ON_SCRIPT")
ENTITY_POWER_OFF_SCRIPT=$(get_value_for_key "POWER_OFF_SCRIPT")
echo "Retrieved ENTITY_TYPE=$ENTITY_TYPE"
echo "Retrieved ENTITY_ID=$ENTITY_ID"
echo "Retrieved ENTITY_NAME=$ENTITY_NAME"
echo "Retrieved ENTITY_POWER_ON_SCRIPT=$ENTITY_POWER_ON_SCRIPT"
echo "Retrieved ENTITY_POWER_OFF_SCRIPT=$ENTITY_POWER_OFF_SCRIPT"

ENTITY_START_COLOR_R=""
ENTITY_START_COLOR_G=""
ENTITY_START_COLOR_B=""
ENTITY_START_RESET=""
if [ "${ENTITY_TYPE}" == "light" ]; then
  echo "Checking required keys for light from loaded CSV file..."
  required=("ENTITY_TYPE" "ENTITY_ID" "ENTITY_NAME" "POWER_ON_SCRIPT" "POWER_OFF_SCRIPT")
  if ! check_required_keys "${required[@]}"; then
    echo "Missing keys for light. Exiting."
    exit 1
  fi
  echo "All required keys found! ($required)"
  
  echo "Retrieving required light values..."
  ENTITY_START_COLOR_R=$(get_value_for_key "START_COLOR_R")
  ENTITY_START_COLOR_G=$(get_value_for_key "START_COLOR_G")
  ENTITY_START_COLOR_B=$(get_value_for_key "START_COLOR_B")
  ENTITY_START_RESET=$(get_value_for_key "START_RESET")
  echo "Retrieved ENTITY_START_COLOR_R=$ENTITY_START_COLOR_R"
  echo "Retrieved ENTITY_START_COLOR_G=$ENTITY_START_COLOR_G"
  echo "Retrieved ENTITY_START_COLOR_B=$ENTITY_START_COLOR_B"
  echo "Retrieved ENTITY_START_RESET=$ENTITY_START_RESET"
fi

DIR_CONFIG="/config"

FILE_CONFIG_NAME="configuration.yaml"
FILE_TEMPLATES_NAME="templates.yaml"
FILE_LIGHT_TEMPLATES_NAME="lights.yaml"
FILE_SWITCH_TEMPLATES_NAME="switches.yaml"
FILE_SCRIPTS_NAME="scripts.yaml"
FILE_INPUT_NUMBERS_NAME="input_numbers.yaml"
FILE_INPUT_BOOLEANS_NAME="input_booleans.yaml"
FILE_INPUT_SELECTS_NAME="input_selects.yaml"

FILE_CONFIG="${DIR_CONFIG}/${FILE_CONFIG_NAME}"
FILE_TEMPLATES="${DIR_CONFIG}/${FILE_TEMPLATES_NAME}"
FILE_LIGHT_TEMPLATES="${DIR_CONFIG}/${FILE_LIGHT_TEMPLATES_NAME}"
FILE_SWITCH_TEMPLATES="${DIR_CONFIG}/${FILE_SWITCH_TEMPLATES_NAME}"
FILE_SCRIPTS="${DIR_CONFIG}/${FILE_SCRIPTS_NAME}"
FILE_INPUT_NUMBERS="${DIR_CONFIG}/${FILE_INPUT_NUMBERS_NAME}"
FILE_INPUT_BOOLEANS="${DIR_CONFIG}/${FILE_INPUT_BOOLEANS_NAME}"
FILE_INPUT_SELECTS="${DIR_CONFIG}/${FILE_INPUT_SELECTS_NAME}"

FILE_SAV_CONFIG="${DIR_CONFIG}/${TIMESTAMP}_${FILE_CONFIG_NAME}.sav"
FILE_SAV_TEMPLATES="${DIR_CONFIG}/${TIMESTAMP}_${FILE_TEMPLATES_NAME}.sav"
FILE_SAV_LIGHT_TEMPLATES="${DIR_CONFIG}/${TIMESTAMP}_${FILE_LIGHT_TEMPLATES_NAME}.sav"
FILE_SAV_SWITCH_TEMPLATES="${DIR_CONFIG}/${TIMESTAMP}_${FILE_SWITCH_TEMPLATES_NAME}.sav"
FILE_SAV_SCRIPTS="${DIR_CONFIG}/${TIMESTAMP}_${FILE_SCRIPTS_NAME}.sav"
FILE_SAV_INPUT_NUMBERS="${DIR_CONFIG}/${TIMESTAMP}_${FILE_INPUT_NUMBERS_NAME}.sav"
FILE_SAV_INPUT_BOOLEANS="${DIR_CONFIG}/${TIMESTAMP}_${FILE_INPUT_BOOLEANS_NAME}.sav"
FILE_SAV_INPUT_SELECTS="${DIR_CONFIG}/${TIMESTAMP}_${FILE_INPUT_SELECTS_NAME}.sav"

DIR_PYTHON_SCRIPTS="${DIR_CONFIG}/python_scripts"
FILE_LED_COLOR_MATCH_SCRIPT="${DIR_PYTHON_SCRIPTS}/led_color_match.py"

ENTITY_FULL_ID="${ENTITY_TYPE}.${ENTITY_ID}"

SCRIPT_NAME_TURN_ON="${ENTITY_ID}_turn_on"
SCRIPT_NAME_TURN_OFF="${ENTITY_ID}_turn_off"
SCRIPT_NAME_SET_COLOR="${ENTITY_ID}_set_color"
SCRIPT_NAME_SET_LEVEL="${ENTITY_ID}_set_level"
SCRIPT_NAME_SET_EFFECT_COLOR="${ENTITY_ID}_set_effect_color"

INPUT_NUMBER_R="${ENTITY_ID}_r"
INPUT_NUMBER_G="${ENTITY_ID}_g"
INPUT_NUMBER_B="${ENTITY_ID}_b"
INPUT_NUMBER_BRIGHTNESS="${ENTITY_ID}_brightness"

INPUT_BOOLEAN_POWER="${ENTITY_ID}_power"

INPUT_SELECT_EFFECTS="${ENTITY_ID}_effects"

# Define target template file
FILE_TEMPLATE_FOR_TYPE=""
if [ "${ENTITY_TYPE}" == "light" ]; then
  FILE_TEMPLATE_FOR_TYPE="${FILE_LIGHT_TEMPLATES}"
fi
if [ "${ENTITY_TYPE}" == "switch" ]; then
  FILE_TEMPLATE_FOR_TYPE="${FILE_SWITCH_TEMPLATES}"
fi


# Check that needed files exist
echo "Ensure HA configurations exists..."
ensure_file_exists "${FILE_CONFIG}"
ensure_file_exists "${FILE_TEMPLATES}"
ensure_file_exists "${FILE_LIGHT_TEMPLATES}"
ensure_file_exists "${FILE_SWITCH_TEMPLATES}"
ensure_file_exists "${FILE_SCRIPTS}"
ensure_file_exists "${FILE_INPUT_NUMBERS}"
ensure_file_exists "${FILE_INPUT_BOOLEANS}"
ensure_file_exists "${FILE_INPUT_SELECTS}"

# Create timestamped save backup of files before editing them
echo "Backuping HA configurations..."
cp "${FILE_CONFIG}" "${FILE_SAV_CONFIG}"
cp "${FILE_TEMPLATES}" "${FILE_SAV_TEMPLATES}"
cp "${FILE_LIGHT_TEMPLATES}" "${FILE_SAV_LIGHT_TEMPLATES}"
cp "${FILE_SWITCH_TEMPLATES}" "${FILE_SAV_SWITCH_TEMPLATES}"
cp "${FILE_SCRIPTS}" "${FILE_SAV_SCRIPTS}"
cp "${FILE_INPUT_NUMBERS}" "${FILE_SAV_INPUT_NUMBERS}"
cp "${FILE_INPUT_BOOLEANS}" "${FILE_SAV_INPUT_BOOLEANS}"
cp "${FILE_INPUT_SELECTS}" "${FILE_SAV_INPUT_SELECTS}"

# Remove previous entity artifacts from configurations files (to be able to restart from a clean base)
echo "Cleaning ${ENTITY_FULL_ID} from HA configurations..."
sed -i "/^python_script:/d" "${FILE_CONFIG}"
sed -i "/^template:/d" "${FILE_CONFIG}"
sed -i "/^script:/d" "${FILE_CONFIG}"
sed -i "/^input_number:/d" "${FILE_CONFIG}"
sed -i "/^input_boolean:/d" "${FILE_CONFIG}"
sed -i "/^input_select:/d" "${FILE_CONFIG}"

sed -i "/^- light:/d" "${FILE_TEMPLATES}"
sed -i "/^- switch:/d" "${FILE_TEMPLATES}"

remove_yaml_subblock "${FILE_TEMPLATE_FOR_TYPE}" "${ENTITY_ID}"
remove_yaml_top_level_block "${FILE_SCRIPTS}" "${SCRIPT_NAME_TURN_ON}"
remove_yaml_top_level_block "${FILE_SCRIPTS}" "${SCRIPT_NAME_TURN_OFF}"
remove_yaml_top_level_block "${FILE_SCRIPTS}" "${SCRIPT_NAME_SET_COLOR}"
remove_yaml_top_level_block "${FILE_SCRIPTS}" "${SCRIPT_NAME_SET_EFFECT_COLOR}"
remove_yaml_top_level_block "${FILE_INPUT_NUMBERS}" "${INPUT_NUMBER_R}"
remove_yaml_top_level_block "${FILE_INPUT_NUMBERS}" "${INPUT_NUMBER_G}"
remove_yaml_top_level_block "${FILE_INPUT_NUMBERS}" "${INPUT_NUMBER_B}"
remove_yaml_top_level_block "${FILE_INPUT_NUMBERS}" "${INPUT_NUMBER_BRIGHTNESS}"
remove_yaml_top_level_block "${FILE_INPUT_BOOLEANS}" "${INPUT_BOOLEAN_POWER}"
remove_yaml_top_level_block "${FILE_INPUT_SELECTS}" "${INPUT_SELECT_EFFECTS}"

# Register detached configurations files into main configuration file
echo "Registering HA detached configurations into HA main configuration ${FILE_CONFIG}..."
grep -qxF "python_script:" "${FILE_CONFIG}" || echo "python_script:" >> "${FILE_CONFIG}"
grep -qxF "template:" "${FILE_CONFIG}" || echo "template: !include templates.yaml" >> "${FILE_CONFIG}"
grep -qxF "script:" "${FILE_CONFIG}" || echo "script: !include scripts.yaml" >> "${FILE_CONFIG}"
grep -qxF "input_number:" "${FILE_CONFIG}" || echo "input_number: !include input_numbers.yaml" >> "${FILE_CONFIG}"
grep -qxF "input_boolean:" "${FILE_CONFIG}" || echo "input_boolean: !include input_booleans.yaml" >> "${FILE_CONFIG}"
grep -qxF "input_select:" "${FILE_CONFIG}" || echo "input_select: !include input_selects.yaml" >> "${FILE_CONFIG}"

grep -qxF -- "- light:" "${FILE_TEMPLATES}" || echo "- light: !include lights.yaml" >> "${FILE_TEMPLATES}"
grep -qxF -- "- switch:" "${FILE_TEMPLATES}" || echo "- switch: !include switches.yaml" >> "${FILE_TEMPLATES}"

# Write python helper script (create or overwrite)
mkdir -p "${DIR_PYTHON_SCRIPTS}"
{ echo; cat <<'EOF'
# led_color_match.py

def hex_to_rgb(hex_color):
    """Convert hex color string to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16)
    )

def color_distance(rgb1, rgb2):
    """Calculate Euclidean distance between two RGB colors."""
    return ((rgb1[0] - rgb2[0]) ** 2 +
            (rgb1[1] - rgb2[1]) ** 2 +
            (rgb1[2] - rgb2[2]) ** 2) ** 0.5

input_color = data.get('color')
color_map = data.get("color_map", [])

if not input_color or len(input_color) != 3:
    logger.error("Missing or invalid 'color' input.")
    raise ValueError("Invalid color input")

if not color_map:
    logger.error("Missing or invalid 'color_map' input.")
    raise ValueError("Invalid color map")

# Find closest match
min_dist = float("inf")
closest_entry = None

for entry in color_map:
    hex_color = entry.get('hex')
    if not hex_color:
        logger.warning(f"At least one entry with missing hex color.")
        continue
    rgb = hex_to_rgb(hex_color)
    dist = color_distance(input_color, rgb)

    if dist < min_dist:
        min_dist = dist
        closest_entry = entry

if closest_entry:
    service_domain = closest_entry.get('service_domain')
    service_name = closest_entry.get('service_name')

    if service_domain and service_name:
        logger.info(f"Calling service: {service_domain}.{service_name}")
        hass.services.call(
            service_domain,
            service_name,
            {},
            False
        )
    else:
        logger.error("Closest match found but service info is missing.")
        raise ValueError("Closest service found, but missing service info")
else:
    logger.error(f"No closest color match found for: {input_color}")
    raise ValueError("No match found")

EOF
} > "${FILE_LED_COLOR_MATCH_SCRIPT}"

# Write input_booleans (create or append)
echo "Writing input_booleans..."
{ echo; cat <<EOF
${INPUT_BOOLEAN_POWER}:
  name: ${ENTITY_NAME} Power
  initial: off

EOF
} >> "${FILE_INPUT_BOOLEANS}"

# Write input_numbers (create or append)
echo "Writing input_numbers..."

if [ "${ENTITY_TYPE}" == "light" ]; then
{ echo; cat <<EOF
${INPUT_NUMBER_R}:
  name: ${ENTITY_NAME} Red value
  min: 0
  max: 255
  step: 1
  initial: ${ENTITY_START_COLOR_R}

${INPUT_NUMBER_G}:
  name: ${ENTITY_NAME} Green value
  min: 0
  max: 255
  step: 1
  initial: ${ENTITY_START_COLOR_G}

${INPUT_NUMBER_B}:
  name: ${ENTITY_NAME} Blue value
  min: 0
  max: 255
  step: 1
  initial: ${ENTITY_START_COLOR_B}

${INPUT_NUMBER_BRIGHTNESS}:
  name: ${ENTITY_NAME} Brightness
  min: 0
  max: 255
  step: 1
  initial: 128

EOF
} >> "${FILE_INPUT_NUMBERS}"
fi

if [ "${ENTITY_TYPE}" == "light" ]; then
# Write input_selects (create or append)
echo "Writing input_selects..."
{ echo; cat <<EOF
${INPUT_SELECT_EFFECTS}:
  name: "${ENTITY_NAME} selectable effects"
  options:
    - "none"
EOF
} >> "${FILE_INPUT_SELECTS}"

echo "Adding color effects into input_selects..."
COLOR_KEYS=$(get_keys_starting_with "COLOR_")
for COLOR_KEY in $COLOR_KEYS; do
  COLOR_IDX="${COLOR_KEY#COLOR_#}"
{ cat <<EOF
    - "effect_color_${COLOR_IDX}"
EOF
} >> "${FILE_INPUT_SELECTS}"
done

echo "Adding standard effects into input_selects..."
EFFECT_KEYS=$(get_keys_starting_with "EFFECT_")
for EFFECT_KEY in $EFFECT_KEYS; do
  EFFECT_IDX="${EFFECT_KEY#EFFECT_}"
{ cat <<EOF
    - "effect_${EFFECT_IDX}"
EOF
} >> "${FILE_INPUT_SELECTS}"
done
fi

# Write scripts (create or append)
echo "Writing script..."

# Write "turn_on" script
echo "Adding turn_on service start into script..."
{ echo; cat <<EOF
${SCRIPT_NAME_TURN_ON}:
  alias: "Turns ON ${ENTITY_NAME}"
  sequence:
EOF
} >> "${FILE_SCRIPTS}"

if [ "${ENTITY_TYPE}" == "light" ]; then
if [ "${ENTITY_START_RESET}" == "true" ]; then
  echo "Adding turn_on \"reset on start\" capabilites to turn_on service into script..."
{ cat <<EOF
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_R}
      data:
        value: ${ENTITY_START_COLOR_R}
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_G}
      data:
        value: ${ENTITY_START_COLOR_G}
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_B}
      data:
        value: ${ENTITY_START_COLOR_B}
EOF
} >> "${FILE_SCRIPTS}"
fi
fi

echo "Adding turn_on service start into script..."
{ cat <<EOF
    - service: script.${ENTITY_POWER_ON_SCRIPT}
    - service: input_boolean.turn_on
      target:
        entity_id: input_boolean.${INPUT_BOOLEAN_POWER}
EOF
} >> "${FILE_SCRIPTS}"

# Write "turn_off" script
echo "Adding turn_off service into script..."
{ echo; cat <<EOF
${SCRIPT_NAME_TURN_OFF}:
  alias: "Turns OFF ${ENTITY_NAME}"
  sequence:
    - service: script.${ENTITY_POWER_OFF_SCRIPT}
    - service: input_boolean.turn_off
      target:
        entity_id: input_boolean.${INPUT_BOOLEAN_POWER}
EOF
} >> "${FILE_SCRIPTS}"

# Write "set_level" (of brightness) script
if [ "${ENTITY_TYPE}" == "light" ]; then
echo "Adding set_level service into script..."
{ echo; cat <<EOF
${SCRIPT_NAME_SET_LEVEL}:
  alias: "Set ${ENTITY_NAME} Brightness"
  sequence:
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_BRIGHTNESS}
      data:
        value: "{{ brightness }}"
EOF
} >> "${FILE_SCRIPTS}"
fi

# Write "set_color" (using RGB) script
if [ "${ENTITY_TYPE}" == "light" ]; then
echo "Adding set_color service start into script..."
{ echo; cat <<EOF
${SCRIPT_NAME_SET_COLOR}:
  alias: "Set ${ENTITY_NAME} Color"
  mode: restart
  fields:
    rgb_color:
      description: "Expected [R,G,B] color to set (will default on nearest color when not available)"
      example: "[${ENTITY_START_COLOR_R}, ${ENTITY_START_COLOR_G}, ${ENTITY_START_COLOR_B}]"
  sequence:
    - condition: template
      value_template: >
        {{ rgb_color is defined and rgb_color | length == 3 }}
    - service: python_script.led_color_match
      data:
        color: "{{ rgb_color }}"
        color_map:
EOF
} >> "${FILE_SCRIPTS}"

echo "Adding set_color \"color_map\" capabilities to set_color service into script..."
COLOR_KEYS=$(get_keys_starting_with "COLOR_")
for COLOR_KEY in $COLOR_KEYS; do
  COLOR_HEX="${COLOR_KEY#COLOR_}"
  COLOR_SCRIPT=$(get_value_for_key "${COLOR_KEY}")
{ cat <<EOF
          - hex: "${COLOR_HEX}"
            service_domain: script
            service_name: ${COLOR_SCRIPT}
EOF
} >> "${FILE_SCRIPTS}"
done
fi

# Write "set_effect_color" (using RGB) script
if [ "${ENTITY_TYPE}" == "light" ]; then
echo "Adding set_effect_color service into script..."
rgb_to_hex ${ENTITY_START_COLOR_R} ${ENTITY_START_COLOR_G} ${ENTITY_START_COLOR_B} START_COLOR_HEX
{ echo; cat <<EOF
${SCRIPT_NAME_SET_EFFECT_COLOR}:
  alias: "Set ${ENTITY_NAME} color effect"
  mode: single
  fields:
    r:
      description: "Red component"
      example: ${ENTITY_START_COLOR_R}
    g:
      description: "Green component"
      example: ${ENTITY_START_COLOR_G}
    b:
      description: "Blue component"
      example: ${ENTITY_START_COLOR_B}
    effect_name:
      description: "Color effect name"
      example: "effect_color_${START_COLOR_HEX}"
  sequence:
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_R}
      data:
        value: "{{ r }}"
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_G}
      data:
        value: "{{ g }}"
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_B}
      data:
        value: "{{ b }}"
    - service: input_select.select_option
      target:
        entity_id: input_select.${INPUT_SELECT_EFFECTS}
      data:
        option: "{{ effect_name }}"
    - service: script.${SCRIPT_NAME_SET_COLOR}
      data:
        rgb_color: [ "{{ r }}", "{{ g }}", "{{ b }}" ]
EOF
} >> "${FILE_SCRIPTS}"
fi

# Write entity template (create or append)
echo "Writing template..."
echo "Adding entity start template..."
{ echo; cat <<EOF
- unique_id: ${ENTITY_ID}
  name: "${ENTITY_NAME}"
  state: "{{ is_state('input_boolean.${INPUT_BOOLEAN_POWER}', 'on') }}"
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

if [ "${ENTITY_TYPE}" == "light" ]; then

echo "Adding entity rgb template..."
{ cat <<EOF
  rgb: "({{states('input_number.${INPUT_NUMBER_R}') | int}}, {{states('input_number.${INPUT_NUMBER_G}') | int}}, {{states('input_number.${INPUT_NUMBER_B}') | int}})"
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

echo "Adding entity effects template start..."
{ cat <<EOF
  effect: "{{ states('input_select.${INPUT_SELECT_EFFECTS}') }}"
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"
printf "  effect_list: \"{{ ['None'" >> "${FILE_TEMPLATE_FOR_TYPE}"

echo "Adding color to entity effects template..."
COLOR_KEYS=$(get_keys_starting_with "COLOR_")
for COLOR_KEY in $COLOR_KEYS; do
  COLOR_DISPLAY=$(get_display_for_key "${COLOR_KEY}")
  printf ", '%s'" "${COLOR_DISPLAY}" >> "${FILE_TEMPLATE_FOR_TYPE}"
done

echo "Adding effects to entity effects template..."
EFFECT_KEYS=$(get_keys_starting_with "EFFECT_")
for EFFECT_KEY in $EFFECT_KEYS; do
  EFFECT_DISPLAY=$(get_display_for_key "${EFFECT_KEY}")
  printf ", '%s'" "${EFFECT_DISPLAY}" >> "${FILE_TEMPLATE_FOR_TYPE}"
done

echo "Adding entity effects template end..."
{ cat <<EOF
  ] }}"
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

fi

echo "Adding entity turn_on/turn_off templates..."
{ cat <<EOF
  turn_on:
    action: script.${SCRIPT_NAME_TURN_ON}
  turn_off:
    action: script.${SCRIPT_NAME_TURN_OFF}
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

if [ "${ENTITY_TYPE}" == "light" ]; then
echo "Adding entity set_rgb template..."
{ cat <<EOF
  set_rgb:
    - action: input_number.set_value
      data:
        value: "{{ r }}"
        entity_id: input_number.${INPUT_NUMBER_R}
    - action: input_number.set_value
      data:
        value: "{{ g }}"
        entity_id: input_number.${INPUT_NUMBER_G}
    - action: input_number.set_value
      data:
        value: "{{ b }}"
        entity_id: input_number.${INPUT_NUMBER_B}
    - action: input_select.select_option
      data:
        entity_id: input_select.${INPUT_SELECT_EFFECTS}
        option: "none"
    - action: script.${SCRIPT_NAME_SET_COLOR}
      data:
        rgb_color:
          - "{{ r }}"
          - "{{ g }}"
          - "{{ b }}"
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

echo "Adding entity set_effect template start..."
{ cat <<EOF
  set_effect:
    - choose:
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

echo "Adding entity set_effect colors template..."
COLOR_KEYS=$(get_keys_starting_with "COLOR_")
for COLOR_KEY in $COLOR_KEYS; do
  COLOR_HEX="${COLOR_KEY#COLOR_#}"
  COLOR_DISPLAY=$(get_display_for_key "${COLOR_KEY}")
  hex_to_rgb "${COLOR_HEX}" COLOR_R COLOR_G COLOR_B
{ cat <<EOF
      - conditions: "{{ effect == '${COLOR_DISPLAY}' }}"
        sequence:
          - service: script.${SCRIPT_NAME_SET_EFFECT_COLOR}
            data:
              r: ${COLOR_R}
              g: ${COLOR_G}
              b: ${COLOR_B}
              effect_name: "effect_color_${COLOR_HEX}"
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"
done

echo "Adding entity set_effect effects template..."
EFFECT_KEYS=$(get_keys_starting_with "EFFECT_")
for EFFECT_KEY in $EFFECT_KEYS; do
  EFFECT_SCRIPT=$(get_value_for_key "${EFFECT_KEY}")
  EFFECT_IDX="${EFFECT_KEY#EFFECT_}"
  EFFECT_DISPLAY=$(get_display_for_key "${EFFECT_KEY}")
{ cat <<EOF
      - conditions: "{{ effect == '${EFFECT_DISPLAY}' }}"
        sequence:
          - action: input_select.select_option
            data:
              entity_id: input_select.${INPUT_SELECT_EFFECTS}
              option: "effect_${EFFECT_IDX}"
          - service: script.${EFFECT_SCRIPT}
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"
done

echo "Adding entity set_effect template end..."
printf "\n" >> "${FILE_SCRIPTS}"

fi

echo "Entity ${ENTITY_FULL_ID} created:"
echo "- Ensure these scripts exist (create them when manually missing):"
echo "  - Power ON: ${ENTITY_POWER_ON_SCRIPT}"
echo "  - Power OFF: ${ENTITY_POWER_OFF_SCRIPT}"
if [ "${ENTITY_TYPE}" == "light" ]; then
  for COLOR_KEY in $COLOR_KEYS; do
    COLOR_HEX="${COLOR_KEY#COLOR_}"
    COLOR_SCRIPT=$(get_value_for_key "${COLOR_KEY}")
    echo "  - Color ${COLOR_HEX}: ${COLOR_SCRIPT}"
  done
fi
echo "- Then restart HA to ensure everything is correctly reloaded (python scripts in particular)"