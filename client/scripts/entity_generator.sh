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
  local type="$2"
  local unique_id="$3"

  awk -v type="$type" -v uid="$unique_id" '
  function leading_spaces(line) {
    match(line, /^[ \t]*/)
    return RLENGTH
  }

  BEGIN {
    inside_type=0
    skip=0
    skip_indent=-1
  }

  {
    # Print for debugging (can comment out later)
    # print "Processing line: [" $0 "]" > "/dev/stderr"

    # Detect entering type block, e.g. "- light:"
    if (inside_type == 0) {
      if ($0 ~ ("^[ \t]*-[ \t]*" type ":")) {
        inside_type=1
        print $0
        next
      }
      print $0
      next
    }

    # If currently skipping lines belonging to the target unique_id block
    if (skip == 1) {
      # Check indentation of current line
      cur_indent = leading_spaces($0)

      # If indentation less or equal than unique_id line, stop skipping
      # Also stop skipping if line is empty (to avoid skipping blank lines belonging to next block)
      if (cur_indent <= skip_indent && $0 ~ /^[ \t]*-/) {
        skip=0
        skip_indent=-1
      } else {
        # Still inside sub-block, skip line
        # print "Skipping line inside target: " $0 > "/dev/stderr"
        next
      }
    }

    # Trim leading spaces for checking unique_id line
    line_trim = $0
    gsub(/^[ \t]+/, "", line_trim)
    gsub(/[ \t]+$/, "", line_trim)

    # Detect unique_id line (allow optional leading dash)
    if (line_trim ~ ("^-?[ \t]*unique_id:[ \t]*" uid "$")) {
      skip=1
      skip_indent = leading_spaces($0)
      # print "Skipping block with unique_id: " uid > "/dev/stderr"
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

# Indexed arrays to hold keys and values
CONFIG_KEYS=()
CONFIG_VALUES=()

load_config_map() {
  local file="$1"
  local key value line line_num=0

  if [[ ! -f "$file" ]]; then
    echo "ERROR: File not found: $file" >&2
    return 1
  fi

  while IFS=',' read -r key value; do
    line_num=$((line_num + 1))

    # Skip comments and empty lines
    [[ -z "$key" || "$key" == \#* ]] && continue

    # Trim whitespace and remove optional surrounding quotes
    key=$(echo "$key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//')
    value=$(echo "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//')

    CONFIG_KEYS+=("$key")
    CONFIG_VALUES+=("$value")
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
required=("ENTITY_TYPE" "ENTITY_ID" "ENTITY_NAME" "POWER_ON_SCRIPT" "POWER_OFF_SCRIPT" "START_COLOR_R" "START_COLOR_G" "START_COLOR_B")
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
ENTITY_START_COLOR_R=$(get_value_for_key "START_COLOR_R")
ENTITY_START_COLOR_G=$(get_value_for_key "START_COLOR_G")
ENTITY_START_COLOR_B=$(get_value_for_key "START_COLOR_B")
ENTITY_START_RESET=$(get_value_for_key "START_RESET")
echo "Retrieved ENTITY_TYPE=$ENTITY_TYPE"
echo "Retrieved ENTITY_ID=$ENTITY_ID"
echo "Retrieved ENTITY_NAME=$ENTITY_NAME"
echo "Retrieved ENTITY_POWER_ON_SCRIPT=$ENTITY_POWER_ON_SCRIPT"
echo "Retrieved ENTITY_POWER_OFF_SCRIPT=$ENTITY_POWER_OFF_SCRIPT"
echo "Retrieved ENTITY_START_COLOR_R=$ENTITY_START_COLOR_R"
echo "Retrieved ENTITY_START_COLOR_G=$ENTITY_START_COLOR_G"
echo "Retrieved ENTITY_START_COLOR_B=$ENTITY_START_COLOR_B"
echo "Retrieved ENTITY_START_RESET=$ENTITY_START_RESET"

DIR_CONFIG="/config"

FILE_CONFIG_NAME="configuration.yaml"
FILE_TEMPLATES_NAME="templates.yaml"
FILE_SCRIPTS_NAME="scripts.yaml"
FILE_INPUT_NUMBERS_NAME="input_numbers.yaml"
FILE_INPUT_BOOLEANS_NAME="input_booleans.yaml"

FILE_CONFIG="${DIR_CONFIG}/${FILE_CONFIG_NAME}"
FILE_TEMPLATES="${DIR_CONFIG}/${FILE_TEMPLATES_NAME}"
FILE_SCRIPTS="${DIR_CONFIG}/${FILE_SCRIPTS_NAME}"
FILE_INPUT_NUMBERS="${DIR_CONFIG}/${FILE_INPUT_NUMBERS_NAME}"
FILE_INPUT_BOOLEANS="${DIR_CONFIG}/${FILE_INPUT_BOOLEANS_NAME}"

FILE_SAV_CONFIG="${DIR_CONFIG}/${TIMESTAMP}_${FILE_CONFIG_NAME}.sav"
FILE_SAV_TEMPLATES="${DIR_CONFIG}/${TIMESTAMP}_${FILE_TEMPLATES_NAME}.sav"
FILE_SAV_SCRIPTS="${DIR_CONFIG}/${TIMESTAMP}_${FILE_SCRIPTS_NAME}.sav"
FILE_SAV_INPUT_NUMBERS="${DIR_CONFIG}/${TIMESTAMP}_${FILE_INPUT_NUMBERS_NAME}.sav"
FILE_SAV_INPUT_BOOLEANS="${DIR_CONFIG}/${TIMESTAMP}_${FILE_INPUT_BOOLEANS_NAME}.sav"

DIR_PYTHON_SCRIPTS="${DIR_CONFIG}/python_scripts"
FILE_LED_COLOR_MATCH_SCRIPT="${DIR_PYTHON_SCRIPTS}/led_color_match.py"

ENTITY_FULL_ID="${ENTITY_TYPE}.${ENTITY_ID}"

SCRIPT_NAME_TURN_ON="${ENTITY_ID}_turn_on"
SCRIPT_NAME_TURN_OFF="${ENTITY_ID}_turn_off"
SCRIPT_NAME_SET_COLOR="${ENTITY_ID}_set_color"
SCRIPT_NAME_SET_LEVEL="${ENTITY_ID}_set_level"

INPUT_NUMBER_R="${ENTITY_ID}_r"
INPUT_NUMBER_G="${ENTITY_ID}_g"
INPUT_NUMBER_B="${ENTITY_ID}_b"
INPUT_NUMBER_BRIGHTNESS="${ENTITY_ID}_brightness"

INPUT_BOOLEAN_POWER="${ENTITY_ID}_power"

# Check that needed files exist
echo "Ensure HA configurations exists..."
ensure_file_exists "${FILE_CONFIG}"
ensure_file_exists "${FILE_TEMPLATES}"
ensure_file_exists "${FILE_SCRIPTS}"
ensure_file_exists "${FILE_INPUT_NUMBERS}"
ensure_file_exists "${FILE_INPUT_BOOLEANS}"

# Create timestamped save backup of files before editing them
echo "Backuping HA configurations..."
cp "${FILE_CONFIG}" "${FILE_SAV_CONFIG}"
cp "${FILE_TEMPLATES}" "${FILE_SAV_TEMPLATES}"
cp "${FILE_SCRIPTS}" "${FILE_SAV_SCRIPTS}"
cp "${FILE_INPUT_NUMBERS}" "${FILE_SAV_INPUT_NUMBERS}"
cp "${FILE_INPUT_BOOLEANS}" "${FILE_SAV_INPUT_BOOLEANS}"

# Remove previous entity artifacts from configurations files (to be able to restart from a clean base)
echo "Cleaning ${ENTITY_FULL_ID} from HA configurations..."
sed -i "/^python_script:/d" "${FILE_CONFIG}"
sed -i "/^template:/d" "${FILE_CONFIG}"
sed -i "/^script:/d" "${FILE_CONFIG}"
sed -i "/^input_number:/d" "${FILE_CONFIG}"
sed -i "/^input_boolean:/d" "${FILE_CONFIG}"
remove_yaml_subblock "${FILE_TEMPLATES}" "${ENTITY_TYPE}" "${ENTITY_ID}"
remove_yaml_top_level_block "${FILE_SCRIPTS}" "${SCRIPT_NAME_TURN_ON}"
remove_yaml_top_level_block "${FILE_SCRIPTS}" "${SCRIPT_NAME_TURN_OFF}"
remove_yaml_top_level_block "${FILE_SCRIPTS}" "${SCRIPT_NAME_SET_COLOR}"
remove_yaml_top_level_block "${FILE_INPUT_NUMBERS}" "${INPUT_NUMBER_R}"
remove_yaml_top_level_block "${FILE_INPUT_NUMBERS}" "${INPUT_NUMBER_G}"
remove_yaml_top_level_block "${FILE_INPUT_NUMBERS}" "${INPUT_NUMBER_B}"
remove_yaml_top_level_block "${FILE_INPUT_NUMBERS}" "${INPUT_NUMBER_BRIGHTNESS}"
remove_yaml_top_level_block "${FILE_INPUT_BOOLEANS}" "${INPUT_BOOLEAN_POWER}"

# Register detached configurations files into main configuration file
echo "Registering HA detached configurations into HA main configuration ${FILE_CONFIG}..."
grep -qxF "python_script:" "${FILE_CONFIG}" || echo "python_script:" >> "${FILE_CONFIG}"
grep -qxF "template:" "${FILE_CONFIG}" || echo "template: !include templates.yaml" >> "${FILE_CONFIG}"
grep -qxF "script:" "${FILE_CONFIG}" || echo "script: !include scripts.yaml" >> "${FILE_CONFIG}"
grep -qxF "input_number:" "${FILE_CONFIG}" || echo "input_number: !include input_numbers.yaml" >> "${FILE_CONFIG}"
grep -qxF "input_boolean:" "${FILE_CONFIG}" || echo "input_boolean: !include input_booleans.yaml" >> "${FILE_CONFIG}"

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

# Write scripts (create or append)
echo "Writing script..."
{ echo; cat <<EOF
${SCRIPT_NAME_TURN_ON}:
  alias: "Turns ON ${ENTITY_NAME}"
  sequence:
EOF
} >> "${FILE_SCRIPTS}"

if [ "${ENTITY_START_RESET}" == "true" ]; then
  echo "Adding reset on start capabilites into turn_on service script..."
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

echo "Adding turn_on/turn_off/set_level/set_color services into script..."
{ cat <<EOF
    - service: script.${ENTITY_POWER_ON_SCRIPT}
    - service: input_boolean.turn_on
      target:
        entity_id: input_boolean.${INPUT_BOOLEAN_POWER}

${SCRIPT_NAME_TURN_OFF}:
  alias: "Turns OFF ${ENTITY_NAME}"
  sequence:
    - service: script.${ENTITY_POWER_OFF_SCRIPT}
    - service: input_boolean.turn_off
      target:
        entity_id: input_boolean.${INPUT_BOOLEAN_POWER}

${SCRIPT_NAME_SET_LEVEL}:
  alias: "Set ${ENTITY_NAME} Brightness"
  sequence:
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_BRIGHTNESS}
      data:
        value: "{{ brightness }}"

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

echo "Adding color_map entries into set_color service script..."
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

# Write entity template (create or append)
echo "Writing template..."
DISPLAY_ENTITY_TYPE="- ${ENTITY_TYPE}:"
if grep -qE "^[[:space:]]*-[[:space:]]*${ENTITY_TYPE}:[[:space:]]*$" "${FILE_TEMPLATES}"; then
  DISPLAY_ENTITY_TYPE=""
fi
{ echo; cat <<EOF
${DISPLAY_ENTITY_TYPE}
    - unique_id: ${ENTITY_ID}
      name: "${ENTITY_NAME}"
      state: "{{ is_state('input_boolean.${INPUT_BOOLEAN_POWER}', 'on') }}"
      rgb: "({{states('input_number.${INPUT_NUMBER_R}') | int}}, {{states('input_number.${INPUT_NUMBER_G}') | int}}, {{states('input_number.${INPUT_NUMBER_B}') | int}})"
      turn_on:
        action: script.${SCRIPT_NAME_TURN_ON}
      turn_off:
        action: script.${SCRIPT_NAME_TURN_OFF}
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
        - action: script.${SCRIPT_NAME_SET_COLOR}
          data:
            rgb_color:
              - "{{ r }}"
              - "{{ g }}"
              - "{{ b }}"

EOF
} >> "${FILE_TEMPLATES}"

echo "Entity ${ENTITY_FULL_ID} created: restart HA to ensure python script is correctly loaded (otherwise you can simply reload HA scripts)"