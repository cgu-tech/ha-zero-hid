#!/bin/bash
TIMESTAMP=$(date +%Y%m%d%H%M%S)$(awk -F. '{printf "%03d", $2/1000}' /proc/uptime)
CURRENT_DIR="$(pwd)"

# Parameters (from command-line args, if provided)
ENTITY_TYPE="${1:-}"
ENTITY_ID="${2:-}"
ENTITY_NAME="${3:-}"

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

  echo "Done removing '${block_name}' from '${file}'"
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

# Prompt until ENTITY_TYPE is filled
while [ -z "$ENTITY_TYPE" ]; do
  read -rp "Enter the entity type (e.g., light, switch, sensor): " ENTITY_TYPE
done

# Prompt until ENTITY_ID is filled
while [ -z "$ENTITY_ID" ]; do
  read -rp "Enter the entity ID without type prefix and lowercase (e.g., illuminated_brick_game): " ENTITY_ID
done

# Prompt until ENTITY_NAME is filled
while [ -z "$ENTITY_NAME" ]; do
  read -rp "Enter the friendly name for the entity (e.g., Illuminated Brick Game): " ENTITY_NAME
done

DIR_CONFIG="/config"
FILE_CONFIG="${DIR_CONFIG}/configuration.yaml"
FILE_TEMPLATES="${DIR_CONFIG}/templates.yaml"
FILE_SCRIPTS="${DIR_CONFIG}/scripts.yaml"
FILE_INPUT_NUMBERS="${DIR_CONFIG}/input_numbers.yaml"
FILE_INPUT_BOOLEANS="${DIR_CONFIG}/input_booleans.yaml"

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
echo "Ensure configurations exists..."
ensure_file_exists "${FILE_CONFIG}"
ensure_file_exists "${FILE_TEMPLATES}"
ensure_file_exists "${FILE_SCRIPTS}"
ensure_file_exists "${FILE_INPUT_NUMBERS}"
ensure_file_exists "${FILE_INPUT_BOOLEANS}"

# Create timestamped save backup of files before editing them
echo "Backuping configurations..."
cp "${FILE_CONFIG}" "${TIMESTAMP}_${FILE_CONFIG}.sav"
cp "${FILE_TEMPLATES}" "${TIMESTAMP}_${FILE_TEMPLATES}.sav"
cp "${FILE_SCRIPTS}" "${TIMESTAMP}_${FILE_SCRIPTS}.sav"
cp "${FILE_INPUT_NUMBERS}" "${TIMESTAMP}_${FILE_INPUT_NUMBERS}.sav"
cp "${FILE_INPUT_BOOLEANS}" "${TIMESTAMP}_${FILE_INPUT_BOOLEANS}.sav"

# Remove previous entity artifacts from configurations files (to be able to restart from a clean base)
echo "Cleaning ${ENTITY_FULL_ID} from configurations..."
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
echo "Registering configurations into ${FILE_CONFIG}..."
grep -qxF "template:" "${FILE_CONFIG}" || echo "template: !include templates.yaml" >> "${FILE_CONFIG}"
grep -qxF "script:" "${FILE_CONFIG}" || echo "script: !include scripts.yaml" >> "${FILE_CONFIG}"
grep -qxF "input_number:" "${FILE_CONFIG}" || echo "input_number: !include input_numbers.yaml" >> "${FILE_CONFIG}"
grep -qxF "input_boolean:" "${FILE_CONFIG}" || echo "input_boolean: !include input_booleans.yaml" >> "${FILE_CONFIG}"


ENTITY_TYPE="${1:-}"
ENTITY_ID="${2:-}"
ENTITY_NAME="${3:-}"
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

# Write input_booleans
{ echo; cat <<EOF
${INPUT_BOOLEAN_POWER}:
  name: ${ENTITY_NAME} Power
  initial: off

EOF
} >> "${FILE_INPUT_BOOLEANS}"

# Write input_numbers
{ echo; cat <<EOF
${INPUT_NUMBER_R}:
  name: ${ENTITY_NAME} Red value
  min: 0
  max: 255
  step: 1
  initial: 230

${INPUT_NUMBER_G}:
  name: ${ENTITY_NAME} Green value
  min: 0
  max: 255
  step: 1
  initial: 221

${INPUT_NUMBER_B}:
  name: ${ENTITY_NAME} Blue value
  min: 0
  max: 255
  step: 1
  initial: 189

${INPUT_NUMBER_BRIGHTNESS}:
  name: ${ENTITY_NAME} Brightness
  min: 0
  max: 255
  step: 1
  initial: 128

EOF
} >> "${FILE_INPUT_NUMBERS}"

# Write scripts
{ echo; cat <<EOF
${SCRIPT_NAME_TURN_ON}:
  alias: "Turns ON ${ENTITY_NAME}"
  sequence:
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_R}
      data:
        value: 230
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_G}
      data:
        value: 221
    - service: input_number.set_value
      target:
        entity_id: input_number.${INPUT_NUMBER_B}
      data:
        value: 189
    - service: script.briksmax_disney_castle_power_on
    - service: input_boolean.turn_on
      target:
        entity_id: input_boolean.${INPUT_BOOLEAN_POWER}

${SCRIPT_NAME_TURN_OFF}:
  alias: "Turns OFF ${ENTITY_NAME}"
  sequence:
    - service: script.briksmax_disney_castle_power_off
    - service: input_boolean.turn_off
      target:
        entity_id: input_boolean.${INPUT_BOOLEAN_POWER}

${SCRIPT_NAME_SET_COLOR}:
  alias: "Set ${ENTITY_NAME} Color"
  mode: restart
  fields:
    rgb_color:
      description: "RGB color list"
      example: "[255, 0, 0]"
  sequence:
    - condition: template
      value_template: >
        {{ rgb_color is defined and rgb_color | length == 3 }}
    - service: python_script.led_color_match
      data:
        color: "{{ rgb_color }}"
        color_map:
          red:
            hex: "#BD2A19"
            service_domain: script
            service_name: briksmax_disney_castle_color_red
          green:
            hex: "#348C52"
            service_domain: script
            service_name: briksmax_disney_castle_color_green
          blue:
            hex: "#0A62B5"
            service_domain: script
            service_name: briksmax_disney_castle_color_blue
          orange:
            hex: "#C74613"
            service_domain: script
            service_name: briksmax_disney_castle_color_orange
          purple:
            hex: "#781F50"
            service_domain: script
            service_name: briksmax_disney_castle_color_purple
          cyan:
            hex: "#5C99BD"
            service_domain: script
            service_name: briksmax_disney_castle_color_cyan
          pink:
            hex: "#C48C83"
            service_domain: script
            service_name: briksmax_disney_castle_color_pink
          yellow:
            hex: "#D4C560"
            service_domain: script
            service_name: briksmax_disney_castle_color_yellow
          white:
            hex: "#E6DDBD"
            service_domain: script
            service_name: briksmax_disney_castle_color_white

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

# Write entity template
DISPLAY_ENTITY_TYPE="- ${ENTITY_TYPE}:"
if grep -qE "^[[:space:]]*-[[:space:]]*${ENTITY_TYPE}:[[:space:]]*$" "${FILE_TEMPLATES}"; then
  echo DISPLAY_ENTITY_TYPE=""
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
