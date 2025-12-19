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
CONFIG_OPTIONS=()

load_config_map() {
  local file="$1"
  local key value display options line line_num=0

  if [[ ! -f "$file" ]]; then
    echo "ERROR: File not found: $file" >&2
    return 1
  fi

  while IFS=',' read -r key value display options; do
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
    # If options is missing, default to empty string
    if [[ -z "$options" ]]; then
      options=""
    else
      options=$(echo "$options" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//')
    fi

    CONFIG_KEYS+=("$key")
    CONFIG_VALUES+=("$value")
    CONFIG_DISPLAYS+=("$display")
    CONFIG_OPTIONS+=("$options")
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

get_options_for_key() {
  local search_key="$1"
  local i

  for i in "${!CONFIG_KEYS[@]}"; do
    if [[ "${CONFIG_KEYS[i]}" == "$search_key" ]]; then
      echo "${CONFIG_OPTIONS[i]}"
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

array_has_values() {
  local array_name="$1"
  local count

  eval "count=\${#${array_name}[@]}"
  (( count > 0 ))
}

newline_separated_has_values() {
  [ -n "$1" ]
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
required=("ENTITY_TYPE" "ENTITY_ID" "ENTITY_NAME")
if ! check_required_keys "${required[@]}"; then
  echo "Missing keys. Exiting."
  exit 1
fi
echo "All required keys found! ($required)"

echo "Retrieving required values..."
ENTITY_TYPE=$(get_value_for_key "ENTITY_TYPE")
ENTITY_ID=$(get_value_for_key "ENTITY_ID")
ENTITY_NAME=$(get_value_for_key "ENTITY_NAME")
ENTITY_POWER_ON_SCRIPTS_KEYS=$(get_keys_starting_with "POWER_ON_SCRIPT")
ENTITY_POWER_OFF_SCRIPTS_KEYS=$(get_keys_starting_with "POWER_OFF_SCRIPT")
echo "Retrieved ENTITY_TYPE=$ENTITY_TYPE"
echo "Retrieved ENTITY_ID=$ENTITY_ID"
echo "Retrieved ENTITY_NAME=$ENTITY_NAME"
echo "Retrieved ENTITY_POWER_ON_SCRIPTS="
for ENTITY_POWER_ON_SCRIPT_KEY in $ENTITY_POWER_ON_SCRIPTS_KEYS; do
  ENTITY_POWER_ON_SCRIPT=$(get_value_for_key "${ENTITY_POWER_ON_SCRIPT_KEY}")
  echo "    - ${ENTITY_POWER_ON_SCRIPT}"
done
echo "Retrieved ENTITY_POWER_OFF_SCRIPTS="
for ENTITY_POWER_OFF_SCRIPT_KEY in $ENTITY_POWER_OFF_SCRIPTS_KEYS; do
  ENTITY_POWER_OFF_SCRIPT=$(get_value_for_key "${ENTITY_POWER_OFF_SCRIPT_KEY}")
  echo "    - ${ENTITY_POWER_OFF_SCRIPT}"
done

if newline_separated_has_values "$ENTITY_POWER_ON_SCRIPTS_KEYS"; then
  echo -n ""
else
  echo "Missing key: at least one key POWER_ON_SCRIPT[...] is required. Exiting."
  exit 1
fi
if newline_separated_has_values "$ENTITY_POWER_OFF_SCRIPTS_KEYS"; then
  echo -n ""
else
  echo "Missing key: at least one key POWER_OFF_SCRIPT[...] is required. Exiting."
  exit 1
fi
ENTITY_START_OVERRIDE=$(get_value_for_key "START_OVERRIDE")

LIGHT_BRIGHTNESS_MAX=""
LIGHT_BRIGHTNESS_MIN=""
LIGHT_BRIGHTNESS_STEP=""
LIGHT_BRIGHTNESS_STEP_UP=""
LIGHT_BRIGHTNESS_STEP_DOWN=""
LIGHT_BRIGHTNESS_DEFAULT=""
LIGHT_COLOR_START_R=""
LIGHT_COLOR_START_G=""
LIGHT_COLOR_START_B=""
LIGHT_COLOR_DEFAULT_R=""
LIGHT_COLOR_DEFAULT_G=""
LIGHT_COLOR_DEFAULT_B=""
LIGHT_HAS_BRIGHTNESS_RESET=1
LIGHT_HAS_BRIGHTNESS=1
LIGHT_HAS_COLOR_RESET=1
LIGHT_HAS_RGB=1
LIGHT_HAS_EFFECT=1
if [ "${ENTITY_TYPE}" == "light" ]; then
  echo "Retrieving optional light values when present..."
  LIGHT_BRIGHTNESS_START=$(get_value_for_key "BRIGHTNESS_START")
  LIGHT_BRIGHTNESS_MAX=$(get_value_for_key "BRIGHTNESS_MAX")
  LIGHT_BRIGHTNESS_MIN=$(get_value_for_key "BRIGHTNESS_MIN")
  LIGHT_BRIGHTNESS_STEP=$(get_value_for_key "BRIGHTNESS_STEP")
  LIGHT_BRIGHTNESS_STEP_UP=$(get_value_for_key "BRIGHTNESS_STEP_UP")
  LIGHT_BRIGHTNESS_STEP_DOWN=$(get_value_for_key "BRIGHTNESS_STEP_DOWN")
  LIGHT_COLOR_START_R=$(get_value_for_key "START_COLOR_R")
  LIGHT_COLOR_START_G=$(get_value_for_key "START_COLOR_G")
  LIGHT_COLOR_START_B=$(get_value_for_key "START_COLOR_B")
  BRIGHTNESS_KEYS=$(get_keys_starting_with "BRIGHTNESS_")
  COLOR_KEYS=$(get_keys_starting_with "COLOR_")
  EFFECT_KEYS=$(get_keys_starting_with "EFFECT_")

  # Check whether or not entity has a reset brightness value (ie. has START_BRIGHTNESS key)
  if [ -n "$LIGHT_BRIGHTNESS_START" ]; then
    LIGHT_HAS_BRIGHTNESS_RESET=0
  fi

  # Check whether or not entity has a reset brightness value (ie. has START_BRIGHTNESS key)
  if [ "$LIGHT_HAS_BRIGHTNESS_RESET" -eq 0 ]; then
    LIGHT_BRIGHTNESS_DEFAULT="$LIGHT_BRIGHTNESS_START"
  else
    LIGHT_BRIGHTNESS_DEFAULT=255
  fi

  # Check whether or not entity has adjustable brightness light (ie. has reset brightness or any COLOR_* key)
  if [ "$LIGHT_HAS_BRIGHTNESS_RESET" -eq 0 ] || newline_separated_has_values "$BRIGHTNESS_"; then
    LIGHT_HAS_BRIGHTNESS=0
  fi

  # Check whether or not entity has a reset color value (ie. has any START_COLOR_* key)
  if [ -n "$LIGHT_COLOR_START_R" ] || [ -n "$LIGHT_COLOR_START_G" ] || [ -n "$LIGHT_COLOR_START_B" ]; then
    LIGHT_HAS_COLOR_RESET=0
  fi

  # Set default RGB colors for input_numbers helper, start colors and colors examples
  if [ "$LIGHT_HAS_COLOR_RESET" -eq 0 ]; then
    # Init to 0 for all 3-components
    LIGHT_COLOR_DEFAULT_R="0"
    LIGHT_COLOR_DEFAULT_G="0"
    LIGHT_COLOR_DEFAULT_B="0"
    
    # Override defined components with user value
    if [ -n "$LIGHT_COLOR_START_R" ]; then
      LIGHT_COLOR_DEFAULT_R="$LIGHT_COLOR_START_R"
    fi
    if [ -n "$LIGHT_COLOR_START_G" ]; then
      LIGHT_COLOR_DEFAULT_G="$LIGHT_COLOR_START_G"
    fi
    if [ -n "$LIGHT_COLOR_START_B" ]; then
      LIGHT_COLOR_DEFAULT_B="$LIGHT_COLOR_START_B"
    fi
  else
    # Fallback to default "entity on" HA color
    LIGHT_COLOR_DEFAULT_R="255"
    LIGHT_COLOR_DEFAULT_G="193"
    LIGHT_COLOR_DEFAULT_B="7"
  fi

  # Check whether or not entity is RGB colored light (ie. has reset color or any COLOR_* key)
  if [ "$LIGHT_HAS_COLOR_RESET" -eq 0 ] || newline_separated_has_values "$COLOR_KEYS"; then
    LIGHT_HAS_RGB=0
  fi

  # Check if RGB capability (implies color effects) OR if at least one "EFFECT_*" key
  if [ "$LIGHT_HAS_RGB" -eq 0 ] || newline_separated_has_values "$EFFECT_KEYS"; then
    LIGHT_HAS_EFFECT=0
  fi

  echo "Retrieved LIGHT_COLOR_START_R=$LIGHT_COLOR_START_R"
  echo "Retrieved LIGHT_COLOR_START_G=$LIGHT_COLOR_START_G"
  echo "Retrieved LIGHT_COLOR_START_B=$LIGHT_COLOR_START_B"
  for COLOR_KEY in $COLOR_KEYS; do
    COLOR_VALUE=$(get_value_for_key "${COLOR_KEY}")
    COLOR_DISPLAY=$(get_display_for_key "${COLOR_KEY}")
    echo "Retrieved ${COLOR_KEY}=${COLOR_VALUE} (display=${COLOR_DISPLAY})"
  done
  for EFFECT_KEY in $EFFECT_KEYS; do
    EFFECT_VALUE=$(get_value_for_key "${EFFECT_KEY}")
    EFFECT_DISPLAY=$(get_display_for_key "${EFFECT_KEY}")
    echo "Retrieved ${EFFECT_KEY}=${EFFECT_VALUE} (display=${EFFECT_DISPLAY})"
  done
  echo "Computed LIGHT_COLOR_DEFAULT_R=$LIGHT_COLOR_DEFAULT_R"
  echo "Computed LIGHT_COLOR_DEFAULT_G=$LIGHT_COLOR_DEFAULT_G"
  echo "Computed LIGHT_COLOR_DEFAULT_B=$LIGHT_COLOR_DEFAULT_B"
  echo "Computed LIGHT_HAS_BRIGHTNESS_RESET=$LIGHT_HAS_BRIGHTNESS_RESET"
  echo "Computed LIGHT_HAS_BRIGHTNESS=$LIGHT_HAS_BRIGHTNESS"
  echo "Computed LIGHT_HAS_COLOR_RESET=$LIGHT_HAS_COLOR_RESET"
  echo "Computed LIGHT_HAS_RGB=$LIGHT_HAS_RGB"
  echo "Computed LIGHT_HAS_EFFECT=$LIGHT_HAS_EFFECT"
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
SCRIPT_NAME_INCREASE_BRIGHTNESS="${ENTITY_ID}_increase_brightness"
SCRIPT_NAME_DECREASE_BRIGHTNESS="${ENTITY_ID}_decrease_brightness"
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
echo "Ensuring HA configurations files common to all entities exists..."
ensure_file_exists "${FILE_CONFIG}"
ensure_file_exists "${FILE_TEMPLATES}"
ensure_file_exists "${FILE_SCRIPTS}"
ensure_file_exists "${FILE_INPUT_BOOLEANS}"
ensure_file_exists "${FILE_LIGHT_TEMPLATES}"
ensure_file_exists "${FILE_INPUT_NUMBERS}"
ensure_file_exists "${FILE_INPUT_SELECTS}"
ensure_file_exists "${FILE_SWITCH_TEMPLATES}"

# Create timestamped save backup of files before editing them
echo "Backuping HA configurations files common to all entities..."
cp "${FILE_CONFIG}" "${FILE_SAV_CONFIG}"
cp "${FILE_TEMPLATES}" "${FILE_SAV_TEMPLATES}"
cp "${FILE_SCRIPTS}" "${FILE_SAV_SCRIPTS}"
cp "${FILE_INPUT_BOOLEANS}" "${FILE_SAV_INPUT_BOOLEANS}"
cp "${FILE_LIGHT_TEMPLATES}" "${FILE_SAV_LIGHT_TEMPLATES}"
cp "${FILE_INPUT_NUMBERS}" "${FILE_SAV_INPUT_NUMBERS}"
cp "${FILE_INPUT_SELECTS}" "${FILE_SAV_INPUT_SELECTS}"
cp "${FILE_SWITCH_TEMPLATES}" "${FILE_SAV_SWITCH_TEMPLATES}"

# Remove previous entity artifacts from configurations files (to be able to restart from a clean base)
echo "Removing ${ENTITY_FULL_ID} from HA ${FILE_TEMPLATE_FOR_TYPE} file..."
remove_yaml_subblock "${FILE_TEMPLATE_FOR_TYPE}" "${ENTITY_ID}"

echo "Removing ${ENTITY_FULL_ID} scripts from HA ${FILE_SCRIPTS} file..."
remove_yaml_top_level_block "${FILE_SCRIPTS}" "${SCRIPT_NAME_TURN_ON}"
remove_yaml_top_level_block "${FILE_SCRIPTS}" "${SCRIPT_NAME_TURN_OFF}"
remove_yaml_top_level_block "${FILE_SCRIPTS}" "${SCRIPT_NAME_INCREASE_BRIGHTNESS}"
remove_yaml_top_level_block "${FILE_SCRIPTS}" "${SCRIPT_NAME_DECREASE_BRIGHTNESS}"
remove_yaml_top_level_block "${FILE_SCRIPTS}" "${SCRIPT_NAME_SET_COLOR}"
remove_yaml_top_level_block "${FILE_SCRIPTS}" "${SCRIPT_NAME_SET_EFFECT_COLOR}"

echo "Removing ${ENTITY_FULL_ID} input_numbers from HA ${FILE_INPUT_NUMBERS} file..."
remove_yaml_top_level_block "${FILE_INPUT_NUMBERS}" "${INPUT_NUMBER_R}"
remove_yaml_top_level_block "${FILE_INPUT_NUMBERS}" "${INPUT_NUMBER_G}"
remove_yaml_top_level_block "${FILE_INPUT_NUMBERS}" "${INPUT_NUMBER_B}"
remove_yaml_top_level_block "${FILE_INPUT_NUMBERS}" "${INPUT_NUMBER_BRIGHTNESS}"

echo "Removing ${ENTITY_FULL_ID} input_booleans from HA ${FILE_INPUT_BOOLEANS} file..."
remove_yaml_top_level_block "${FILE_INPUT_BOOLEANS}" "${INPUT_BOOLEAN_POWER}"

echo "Removing ${ENTITY_FULL_ID} input_selects from HA ${FILE_INPUT_SELECTS} file..."
remove_yaml_top_level_block "${FILE_INPUT_SELECTS}" "${INPUT_SELECT_EFFECTS}"

echo "Unregistering HA configurations files references common to all entities from HA main configuration file..."
sed -i "/^python_script:/d" "${FILE_CONFIG}"
sed -i "/^template:/d" "${FILE_CONFIG}"
sed -i "/^script:/d" "${FILE_CONFIG}"
sed -i "/^input_boolean:/d" "${FILE_CONFIG}"

if [ "${ENTITY_TYPE}" == "light" ]; then
  echo "Unregistering HA configurations files references specific to light entities from HA templates configuration file..."
  sed -i "/^- light:/d" "${FILE_TEMPLATES}"
else
  if [ -z "$(tr -d '[:space:]' < ${FILE_LIGHT_TEMPLATES})" ]; then
    echo "Detected unused HA file ${FILE_LIGHT_TEMPLATES}: removing it with associated reference into HA templates configuration file"
    sed -i "/^- light:/d" "${FILE_TEMPLATES}"
    rm "${FILE_LIGHT_TEMPLATES}"
  else
    echo "Detected used HA file ${FILE_LIGHT_TEMPLATES}: will preserve this file and its reference into HA templates configuration file"
  fi
fi
if [ "$LIGHT_HAS_RGB" -eq 0 ] || [ "$LIGHT_HAS_BRIGHTNESS" -eq 0 ]; then
  echo "Unregistering HA configurations files references specific to RGB or Brightness entities from HA main configuration file..."
  sed -i "/^input_number:/d" "${FILE_CONFIG}"
else
  if [ -z "$(tr -d '[:space:]' < ${FILE_INPUT_NUMBERS})" ]; then
    echo "Detected unused HA file ${FILE_INPUT_NUMBERS}: removing it with associated reference into HA main configuration file"
    sed -i "/^input_number:/d" "${FILE_CONFIG}"
    rm "${FILE_INPUT_NUMBERS}"
  else
    echo "Detected used HA file ${FILE_INPUT_NUMBERS}: will preserve this file and its reference into HA main configuration file"
  fi
fi
if [ "$LIGHT_HAS_EFFECT" -eq 0 ]; then
  echo "Unregistering HA configurations files references specific to Effect entities from HA main configuration file..."
  sed -i "/^input_select:/d" "${FILE_CONFIG}"
else
  if [ -z "$(tr -d '[:space:]' < ${FILE_INPUT_SELECTS})" ]; then
    echo "Detected unused HA file ${FILE_INPUT_SELECTS}: removing it with associated reference into HA main configuration file"
    sed -i "/^input_select:/d" "${FILE_CONFIG}"
    rm "${FILE_INPUT_SELECTS}"
  else
    echo "Detected used HA file ${FILE_INPUT_SELECTS}: will preserve this file and its reference into HA main configuration file"
  fi
fi
if [ "${ENTITY_TYPE}" == "switch" ]; then
  echo "Unregistering HA configurations files references specific to switch entities from HA templates configuration file..."
  sed -i "/^- switch:/d" "${FILE_TEMPLATES}"
else
  if [ -z "$(tr -d '[:space:]' < ${FILE_SWITCH_TEMPLATES})" ]; then
    echo "Detected unused HA file ${FILE_SWITCH_TEMPLATES}: removing it with associated reference into HA templates configuration file"
    sed -i "/^- switch:/d" "${FILE_TEMPLATES}"
    rm "${FILE_SWITCH_TEMPLATES}"
  else
    echo "Detected used HA file ${FILE_SWITCH_TEMPLATES}: will preserve this file and its reference into HA templates configuration file"
  fi
fi


# Register detached configurations files into main configuration file
echo "Registering HA configurations files references common to all entities into HA main configuration..."
grep -qxF "python_script:" "${FILE_CONFIG}" || echo "python_script:" >> "${FILE_CONFIG}"
grep -qxF "template:" "${FILE_CONFIG}" || echo "template: !include templates.yaml" >> "${FILE_CONFIG}"
grep -qxF "script:" "${FILE_CONFIG}" || echo "script: !include scripts.yaml" >> "${FILE_CONFIG}"
grep -qxF "input_boolean:" "${FILE_CONFIG}" || echo "input_boolean: !include input_booleans.yaml" >> "${FILE_CONFIG}"

if [ "${ENTITY_TYPE}" == "light" ]; then
  echo "Registering HA lights configuration file reference into HA templates configuration file..."
  grep -qxF -- "- light:" "${FILE_TEMPLATES}" || echo "- light: !include lights.yaml" >> "${FILE_TEMPLATES}"
fi
if [ "$LIGHT_HAS_RGB" -eq 0 ] || [ "$LIGHT_HAS_BRIGHTNESS" -eq 0 ]; then
  echo "Registering HA input_numbers configuration file reference into HA main configuration file..."
  grep -qxF "input_number:" "${FILE_CONFIG}" || echo "input_number: !include input_numbers.yaml" >> "${FILE_CONFIG}"
fi
if [ "$LIGHT_HAS_EFFECT" -eq 0 ]; then
  echo "Registering HA input_numbers configuration file reference into HA main configuration file..."
  grep -qxF "input_select:" "${FILE_CONFIG}" || echo "input_select: !include input_selects.yaml" >> "${FILE_CONFIG}"
fi
if [ "${ENTITY_TYPE}" == "switch" ]; then
  echo "Registering HA switches configuration file reference into HA templates configuration file..."
  grep -qxF -- "- switch:" "${FILE_TEMPLATES}" || echo "- switch: !include switches.yaml" >> "${FILE_TEMPLATES}"
fi


# Write python helper common to all RGB lights (create or overwrite)
echo "Writing led_color_match python helper common to all RGB lights..."
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
echo "Writing input_booleans for entity power state..."
{ echo; cat <<EOF
${INPUT_BOOLEAN_POWER}:
  name: ${ENTITY_NAME} Power
  initial: off

EOF
} >> "${FILE_INPUT_BOOLEANS}"

# Write input_numbers (create or append)
echo "Writing input_numbers..."
if [ "${ENTITY_TYPE}" == "light" ]; then
echo "Writing input_numbers for light state..."

if [ "$LIGHT_HAS_RGB" -eq 0 ]; then
echo "Writing input_numbers for light RGB state..."
{ echo; cat <<EOF
${INPUT_NUMBER_R}:
  name: ${ENTITY_NAME} Red value
  min: 0
  max: 255
  step: 1
  initial: ${LIGHT_COLOR_DEFAULT_R}

${INPUT_NUMBER_G}:
  name: ${ENTITY_NAME} Green value
  min: 0
  max: 255
  step: 1
  initial: ${LIGHT_COLOR_DEFAULT_G}

${INPUT_NUMBER_B}:
  name: ${ENTITY_NAME} Blue value
  min: 0
  max: 255
  step: 1
  initial: ${LIGHT_COLOR_DEFAULT_B}

EOF
} >> "${FILE_INPUT_NUMBERS}"
fi

if [ "$LIGHT_HAS_BRIGHTNESS" -eq 0 ]; then
echo "Writing input_numbers for light Brightness state..."
{ echo; cat <<EOF
${INPUT_NUMBER_BRIGHTNESS}:
  name: ${ENTITY_NAME} Brightness
  min: ${LIGHT_BRIGHTNESS_MIN}
  max: ${LIGHT_BRIGHTNESS_MAX}
  step: ${LIGHT_BRIGHTNESS_STEP}
  initial: ${LIGHT_BRIGHTNESS_DEFAULT}

EOF
} >> "${FILE_INPUT_NUMBERS}"
fi

fi

# Write input_selects (create or append)
echo "Writing input_selects..."
if [ "${ENTITY_TYPE}" == "light" ]; then
echo "Writing input_selects for light..."

if [ "$LIGHT_HAS_EFFECT" -eq 0 ]; then
echo "Writing input_selects for light effect state..."
{ echo; cat <<EOF
${INPUT_SELECT_EFFECTS}:
  name: "${ENTITY_NAME} effects"
  options:
    - "none"
EOF
} >> "${FILE_INPUT_SELECTS}"
fi

if [ "$LIGHT_HAS_RGB" -eq 0 ]; then
echo "Writing input_selects list of light color effects..."
COLOR_KEYS=$(get_keys_starting_with "COLOR_")
for COLOR_KEY in $COLOR_KEYS; do
  COLOR_IDX="${COLOR_KEY#COLOR_#}"
{ cat <<EOF
    - "effect_color_${COLOR_IDX}"
EOF
} >> "${FILE_INPUT_SELECTS}"
done
fi

if [ "$LIGHT_HAS_EFFECT" -eq 0 ]; then
echo "Writing input_selects list of light standard effects..."
EFFECT_KEYS=$(get_keys_starting_with "EFFECT_")
for EFFECT_KEY in $EFFECT_KEYS; do
  EFFECT_IDX="${EFFECT_KEY#EFFECT_}"
{ cat <<EOF
    - "effect_${EFFECT_IDX}"
EOF
} >> "${FILE_INPUT_SELECTS}"
done
fi

fi

# Write scripts (create or append)
echo "Writing scripts..."

# Write "turn_on" script
echo "Writing scripts turn_on..."
{ echo; cat <<EOF
${SCRIPT_NAME_TURN_ON}:
  alias: "Turns ON ${ENTITY_NAME}"
  sequence:
EOF
} >> "${FILE_SCRIPTS}"

if [ "${ENTITY_START_OVERRIDE}" == "WHEN_EFFECT_SET_COLOR" ]; then
echo "Writing scripts turn_on start override WHEN_EFFECT_SET_COLOR start..."
{ echo; cat <<EOF
  - variables:
      previous_effect: "{{ states('input_select.${INPUT_SELECT_EFFECTS}') }}"
      previous_r: "{{ states('input_number.${INPUT_NUMBER_R}') | int }}"
      previous_g: "{{ states('input_number.${INPUT_NUMBER_G}') | int }}"
      previous_b: "{{ states('input_number.${INPUT_NUMBER_B}') | int }}"
EOF
} >> "${FILE_SCRIPTS}"
fi

if [ "${ENTITY_TYPE}" == "light" ]; then
echo "Writing scripts turn_on for light..."

if [ "$LIGHT_HAS_BRIGHTNESS_RESET" -eq 0 ]; then
echo "Writing scripts turn_on for light brightness reset..."
{ cat <<EOF
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_BRIGHTNESS}
      data:
        value: ${LIGHT_BRIGHTNESS_DEFAULT}
EOF
} >> "${FILE_SCRIPTS}"
fi

if [ "$LIGHT_HAS_COLOR_RESET" -eq 0 ]; then
echo "Writing scripts turn_on for light color reset..."
{ cat <<EOF
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_R}
      data:
        value: ${LIGHT_COLOR_DEFAULT_R}
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_G}
      data:
        value: ${LIGHT_COLOR_DEFAULT_G}
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_B}
      data:
        value: ${LIGHT_COLOR_DEFAULT_B}
EOF
} >> "${FILE_SCRIPTS}"
fi

fi

echo "Writing scripts turn_on adding power on actions..."
for ENTITY_POWER_ON_SCRIPT_KEY in $ENTITY_POWER_ON_SCRIPTS_KEYS; do
  ENTITY_POWER_ON_SCRIPT=$(get_value_for_key "${ENTITY_POWER_ON_SCRIPT_KEY}")
{ cat <<EOF
    - service: script.${ENTITY_POWER_ON_SCRIPT}
EOF
} >> "${FILE_SCRIPTS}"
done

echo "Writing scripts turn_on adding power on state update..."
{ cat <<EOF
    - service: input_boolean.turn_on
      target:
        entity_id: input_boolean.${INPUT_BOOLEAN_POWER}
EOF
} >> "${FILE_SCRIPTS}"

if [ "${ENTITY_START_OVERRIDE}" == "WHEN_EFFECT_SET_COLOR" ]; then
echo "Writing scripts turn_on start override WHEN_EFFECT_SET_COLOR end..."
{ echo; cat <<EOF
  - choose:
      - conditions:
          - condition: template
            value_template: "{{ previous_effect != 'none' }}"
        sequence:
          - action: script.${SCRIPT_NAME_SET_COLOR}
            data:
              rgb_color:
                - "{{ previous_r }}"
                - "{{ previous_g }}"
                - "{{ previous_b }}"
EOF
} >> "${FILE_SCRIPTS}"
fi

# Write "turn_off" script
echo "Writing scripts turn_off..."
{ echo; cat <<EOF
${SCRIPT_NAME_TURN_OFF}:
  alias: "Turns OFF ${ENTITY_NAME}"
  sequence:
EOF
} >> "${FILE_SCRIPTS}"

echo "Writing scripts turn_off adding power off actions..."
for ENTITY_POWER_OFF_SCRIPT_KEY in $ENTITY_POWER_OFF_SCRIPTS_KEYS; do
  ENTITY_POWER_OFF_SCRIPT=$(get_value_for_key "${ENTITY_POWER_OFF_SCRIPT_KEY}")
{ cat <<EOF
    - service: script.${ENTITY_POWER_OFF_SCRIPT}
EOF
} >> "${FILE_SCRIPTS}"
done

echo "Writing scripts turn_off adding power off state update..."
{ cat <<EOF
    - service: input_boolean.turn_off
      target:
        entity_id: input_boolean.${INPUT_BOOLEAN_POWER}
EOF
} >> "${FILE_SCRIPTS}"

# Write "set_level" (of brightness) script
echo "Writing scripts set_level..."
if [ "${ENTITY_TYPE}" == "light" ]; then
echo "Writing scripts set_level for light..."

if [ "$LIGHT_HAS_BRIGHTNESS" -eq 0 ]; then
echo "Writing scripts set_level for light brightness increase..."
{ echo; cat <<EOF
${SCRIPT_NAME_INCREASE_BRIGHTNESS}:
  mode: single
  sequence:
    - variables:
        current: "{{ states('input_number.${INPUT_NUMBER_BRIGHTNESS}') | int(${LIGHT_BRIGHTNESS_MAX}) }}"
        next: "{{ [current + ${LIGHT_BRIGHTNESS_STEP}, ${LIGHT_BRIGHTNESS_MAX}] | min }}"
    - condition: template
      value_template: "{{ next > current }}"
    - service: input_number.set_value
      data:
        entity_id: input_number.${INPUT_NUMBER_BRIGHTNESS}
        value: "{{ next }}"
    - service: script.${LIGHT_BRIGHTNESS_STEP_UP}
    - delay: "00:00:01"
EOF
} >> "${FILE_SCRIPTS}"

echo "Writing scripts set_level for light brightness decrease..."
{ echo; cat <<EOF
${SCRIPT_NAME_DECREASE_BRIGHTNESS}:
  mode: single
  sequence:
    - variables:
        current: "{{ states('input_number.${INPUT_NUMBER_BRIGHTNESS}') | int(${LIGHT_BRIGHTNESS_MAX}) }}"
        next: "{{ [current - ${LIGHT_BRIGHTNESS_STEP}, ${LIGHT_BRIGHTNESS_MIN}] | max }}"
    - condition: template
      value_template: "{{ next < current }}"
    - service: input_number.set_value
      data:
        entity_id: input_number.${INPUT_NUMBER_BRIGHTNESS}
        value: "{{ next }}"
    - service: script.${LIGHT_BRIGHTNESS_STEP_DOWN}
    - delay: "00:00:01"
EOF
} >> "${FILE_SCRIPTS}"
fi

fi

# Write "set_color" (as RGB) script
echo "Writing scripts set_color..."
if [ "${ENTITY_TYPE}" == "light" ]; then
echo "Writing scripts set_color for light..."

if [ "$LIGHT_HAS_RGB" -eq 0 ]; then
echo "Writing scripts set_color for light RGB state update..."
{ echo; cat <<EOF
${SCRIPT_NAME_SET_COLOR}:
  alias: "Set ${ENTITY_NAME} Color"
  mode: restart
  fields:
    rgb_color:
      description: "Expected [R,G,B] color to set (will default on nearest color when not available)"
      example: "[${LIGHT_COLOR_DEFAULT_R}, ${LIGHT_COLOR_DEFAULT_G}, ${LIGHT_COLOR_DEFAULT_B}]"
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

echo "Writing scripts set_color map of restricted available colors for light RGB state update..."
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

fi

# Write "set_effect_color" (as human-readable color effect) script
echo "Writing scripts set_effect_color..."
if [ "${ENTITY_TYPE}" == "light" ]; then
echo "Writing scripts set_effect_color for light..."

if [ "$LIGHT_HAS_RGB" -eq 0 ]; then
echo "Writing scripts set_effect_color for light RGB fixed color effect..."
rgb_to_hex ${LIGHT_COLOR_DEFAULT_R} ${LIGHT_COLOR_DEFAULT_G} ${LIGHT_COLOR_DEFAULT_B} START_COLOR_HEX
{ echo; cat <<EOF
${SCRIPT_NAME_SET_EFFECT_COLOR}:
  alias: "Set ${ENTITY_NAME} color effect"
  mode: single
  fields:
    r:
      description: "Red component"
      example: ${LIGHT_COLOR_DEFAULT_R}
    g:
      description: "Green component"
      example: ${LIGHT_COLOR_DEFAULT_G}
    b:
      description: "Blue component"
      example: ${LIGHT_COLOR_DEFAULT_B}
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

fi

# Write entity template (create or append)
echo "Writing ${ENTITY_TYPE}s template..."

# Write "state" state template
echo "Writing ${ENTITY_TYPE}s template for ${ENTITY_TYPE} main state..."
{ echo; cat <<EOF
- unique_id: ${ENTITY_ID}
  name: "${ENTITY_NAME}"
  state: "{{ is_state('input_boolean.${INPUT_BOOLEAN_POWER}', 'on') }}"
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

if [ "${ENTITY_TYPE}" == "light" ]; then
echo "Writing ${ENTITY_TYPE}s template for light other states..."

# Write "brightness" state template
if [ "$LIGHT_HAS_BRIGHTNESS" -eq 0 ]; then
echo "Writing ${ENTITY_TYPE}s template for light brightness state..."
{ cat <<EOF
  level: "{{ states('input_number.${INPUT_NUMBER_BRIGHTNESS}') | int(${LIGHT_BRIGHTNESS_MAX}) }}"
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

else

# Write "static brightness" template for RGB color with non-customizable brightness (but still HA displays the slider)
if [ "$LIGHT_HAS_RGB" -eq 0 ]; then
echo "Writing ${ENTITY_TYPE}s template for light static brightness state..."
{ cat <<EOF
  level: 255
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"
fi

fi

# Write "rgb" state template
if [ "$LIGHT_HAS_RGB" -eq 0 ]; then
echo "Writing ${ENTITY_TYPE}s template for light RGB state..."
{ cat <<EOF
  rgb: "({{states('input_number.${INPUT_NUMBER_R}') | int}}, {{states('input_number.${INPUT_NUMBER_G}') | int}}, {{states('input_number.${INPUT_NUMBER_B}') | int}})"
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"
fi

# Write "effect" state template
if [ "$LIGHT_HAS_EFFECT" -eq 0 ]; then
echo "Writing ${ENTITY_TYPE}s template for light Effect state..."
{ cat <<EOF
  effect: >
    {% set e = states('input_select.${INPUT_SELECT_EFFECTS}') %}
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

# to track first effect (will need "if" condtion only for the first, "elif" condition for second+)
IS_FIRST_EFFECT=0

echo "Writing ${ENTITY_TYPE}s mapping between supported RGB color effect backend and frontend states..."
COLOR_KEYS=$(get_keys_starting_with "COLOR_")
for COLOR_KEY in $COLOR_KEYS; do
  COLOR_DISPLAY=$(get_display_for_key "${COLOR_KEY}")
  COLOR_IDX="${COLOR_KEY#COLOR_#}"
  CONDITION_PREFIX=""
  if [ "$IS_FIRST_EFFECT" -eq 0 ]; then
    IS_FIRST_EFFECT=1
    CONDITION_PREFIX="if"
  else
    CONDITION_PREFIX="elif"
  fi
  printf "    {%% %s e == '%s' %%}%s\n" "${CONDITION_PREFIX}" "effect_color_${COLOR_IDX}" "${COLOR_DISPLAY}" >> "${FILE_TEMPLATE_FOR_TYPE}"
done

echo "Writing ${ENTITY_TYPE}s mapping between supported standard effect backend and frontend states..."
EFFECT_KEYS=$(get_keys_starting_with "EFFECT_")
for EFFECT_KEY in $EFFECT_KEYS; do
  EFFECT_DISPLAY=$(get_display_for_key "${EFFECT_KEY}")
  EFFECT_IDX="${EFFECT_KEY#EFFECT_}"
  CONDITION_PREFIX=""
  if [ "$IS_FIRST_EFFECT" -eq 0 ]; then
    IS_FIRST_EFFECT=1
    CONDITION_PREFIX="if"
  else
    CONDITION_PREFIX="elif"
  fi
  printf "    {%% %s e == '%s' %%}%s\n" "${CONDITION_PREFIX}" "effect_${EFFECT_IDX}" "${EFFECT_DISPLAY}" >> "${FILE_TEMPLATE_FOR_TYPE}"
done

echo "Writing ${ENTITY_TYPE}s template list end for all effects..."
{ cat <<EOF
    {% else %}None
    {% endif %}
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

# Write "effect_list" state template
printf "  effect_list: \"{{ ['None'" >> "${FILE_TEMPLATE_FOR_TYPE}"

echo "Writing ${ENTITY_TYPE}s template list of supported RGB color effect states..."
COLOR_KEYS=$(get_keys_starting_with "COLOR_")
for COLOR_KEY in $COLOR_KEYS; do
  COLOR_DISPLAY=$(get_display_for_key "${COLOR_KEY}")
  printf ", '%s'" "${COLOR_DISPLAY}" >> "${FILE_TEMPLATE_FOR_TYPE}"
done

echo "Writing ${ENTITY_TYPE}s template list of supported standard effect states..."
EFFECT_KEYS=$(get_keys_starting_with "EFFECT_")
for EFFECT_KEY in $EFFECT_KEYS; do
  EFFECT_DISPLAY=$(get_display_for_key "${EFFECT_KEY}")
  printf ", '%s'" "${EFFECT_DISPLAY}" >> "${FILE_TEMPLATE_FOR_TYPE}"
done

echo "Writing ${ENTITY_TYPE}s template list end for all effects..."
{ cat <<EOF
  ] }}"
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

fi

fi

# Write "turn_on" and "turn_off" actions templates
echo "Writing ${ENTITY_TYPE}s template for turn_on and turn_off actions..."
{ cat <<EOF
  turn_on:
    action: script.${SCRIPT_NAME_TURN_ON}
  turn_off:
    action: script.${SCRIPT_NAME_TURN_OFF}
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

# Write other actions templates
echo "Writing ${ENTITY_TYPE}s template for other actions..."

if [ "${ENTITY_TYPE}" == "light" ]; then
echo "Writing ${ENTITY_TYPE}s template for light other actions..."

# Write "set_level" action template
if [ "$LIGHT_HAS_BRIGHTNESS" -eq 0 ]; then
echo "Writing ${ENTITY_TYPE}s template for light set_level action..."
{ cat <<EOF
  set_level:
    - variables:
        current: "{{ states('input_number.${INPUT_NUMBER_BRIGHTNESS}') | int(${LIGHT_BRIGHTNESS_MAX}) }}"
        target: >
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

# Fill all fixed brightness levels
LIGHT_BRIGHTNESS_MARK="$LIGHT_BRIGHTNESS_MAX"
LIGHT_BRIGHTNESS_STEP_IDX="1"
LIGHT_BRIGHTNESS_FIRST_LEVEL=0

while (( LIGHT_BRIGHTNESS_MARK > LIGHT_BRIGHTNESS_MIN )); do
  LIGHT_BRIGHTNESS_LEVEL_TRIGGER=$(( LIGHT_BRIGHTNESS_STEP_IDX * LIGHT_BRIGHTNESS_STEP + LIGHT_BRIGHTNESS_STEP / 2 ))
  LIGHT_BRIGHTNESS_LEVEL=$(( LIGHT_BRIGHTNESS_STEP_IDX * LIGHT_BRIGHTNESS_STEP ))

  if [ "$LIGHT_BRIGHTNESS_FIRST_LEVEL" -eq 0 ]; then
    LIGHT_BRIGHTNESS_FIRST_LEVEL=1
    printf "          {%% if brightness <= %s %%} %s\n" "${LIGHT_BRIGHTNESS_LEVEL_TRIGGER}" "${LIGHT_BRIGHTNESS_LEVEL}" >> "${FILE_TEMPLATE_FOR_TYPE}"
  else
    printf "          {%% elif brightness <= %s %%} %s\n" "${LIGHT_BRIGHTNESS_LEVEL_TRIGGER}" "${LIGHT_BRIGHTNESS_LEVEL}" >> "${FILE_TEMPLATE_FOR_TYPE}"
  fi

  LIGHT_BRIGHTNESS_MARK=$(( LIGHT_BRIGHTNESS_MARK - LIGHT_BRIGHTNESS_STEP ))
  LIGHT_BRIGHTNESS_STEP_IDX=$(( LIGHT_BRIGHTNESS_STEP_IDX + 1 ))
done

{ cat <<EOF
          {% else %} ${LIGHT_BRIGHTNESS_MAX}
          {% endif %}
        steps: "{{ (target - current) // ${LIGHT_BRIGHTNESS_STEP} }}"
    - repeat:
        count: "{{ steps | abs }}"
        sequence:
          - choose:
            - conditions: "{{ steps > 0 }}"
              sequence:
                - service: script.${SCRIPT_NAME_INCREASE_BRIGHTNESS}
            - conditions: "{{ steps < 0 }}"
              sequence:
                - service: script.${SCRIPT_NAME_DECREASE_BRIGHTNESS}
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

else

# Write "static brightness" template for RGB color with non-customizable brightness (but still HA displays the slider)
if [ "$LIGHT_HAS_RGB" -eq 0 ]; then
echo "Writing ${ENTITY_TYPE}s template for light set_level action with static brightness..."
{ cat <<EOF
  set_level:
    - stop: "Brightness locked"
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"
fi

fi

# Write "set_rgb" action template
if [ "$LIGHT_HAS_RGB" -eq 0 ]; then
echo "Writing ${ENTITY_TYPE}s template for light set_rgb action..."
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
fi

# Write "set_effect" action template
if [ "$LIGHT_HAS_EFFECT" -eq 0 ]; then
echo "Writing ${ENTITY_TYPE}s template for light set_effect action..."
{ cat <<EOF
  set_effect:
    - choose:
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"

# Write "set_effect" actions templates for fixed colors
echo "Writing ${ENTITY_TYPE}s template list of supported RGB color effect actions..."
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

# Write "set_effect" actions templates for standard effects
echo "Writing ${ENTITY_TYPE}s template list of supported standard effect actions..."
EFFECT_KEYS=$(get_keys_starting_with "EFFECT_")
for EFFECT_KEY in $EFFECT_KEYS; do
  EFFECT_SCRIPT=$(get_value_for_key "${EFFECT_KEY}")
  EFFECT_IDX="${EFFECT_KEY#EFFECT_}"
  EFFECT_DISPLAY=$(get_display_for_key "${EFFECT_KEY}")
  EFFECT_OPTIONS=$(get_options_for_key "${EFFECT_KEY}")
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

if [ "${EFFECT_OPTIONS}" == "BUTTON" ]; then
{ cat <<EOF
          - action: input_select.select_option
            data:
              entity_id: input_select.${INPUT_SELECT_EFFECTS}
              option: "none"
EOF
} >> "${FILE_TEMPLATE_FOR_TYPE}"
fi

done

echo "Writing ${ENTITY_TYPE}s template list end for all effect actions..."
printf "\n" >> "${FILE_SCRIPTS}"
fi

fi

echo "Entity ${ENTITY_FULL_ID} created:"
echo "- Ensure these scripts exist (create them when manually when missing):"
echo "  - Power ON:"
for ENTITY_POWER_ON_SCRIPT_KEY in $ENTITY_POWER_ON_SCRIPTS_KEYS; do
  ENTITY_POWER_ON_SCRIPT=$(get_value_for_key "${ENTITY_POWER_ON_SCRIPT_KEY}")
  echo "    - ${ENTITY_POWER_ON_SCRIPT}"
done
echo "  - Power OFF:"
for ENTITY_POWER_OFF_SCRIPT_KEY in $ENTITY_POWER_OFF_SCRIPTS_KEYS; do
  ENTITY_POWER_OFF_SCRIPT=$(get_value_for_key "${ENTITY_POWER_OFF_SCRIPT_KEY}")
  echo "    - ${ENTITY_POWER_OFF_SCRIPT}"
done
if [ "${ENTITY_TYPE}" == "light" ]; then
  for COLOR_KEY in $COLOR_KEYS; do
    COLOR_HEX="${COLOR_KEY#COLOR_}"
    COLOR_SCRIPT=$(get_value_for_key "${COLOR_KEY}")
    echo "  - Color ${COLOR_HEX}: ${COLOR_SCRIPT}"
  done
  for EFFECT_KEY in $EFFECT_KEYS; do
    EFFECT_DISPLAY=$(get_display_for_key "${EFFECT_KEY}")
    EFFECT_SCRIPT=$(get_value_for_key "${EFFECT_KEY}")
    echo "  - Effect ${EFFECT_DISPLAY}: ${EFFECT_SCRIPT}"
  done
fi
echo "- Then restart HA to ensure everything is correctly reloaded (python scripts in particular)"