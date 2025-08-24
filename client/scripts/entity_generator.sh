#!/bin/bash
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
  read -rp "Enter the entity ID without type prefix (e.g., illuminated_brick_game): " ENTITY_ID
done

# Prompt until ENTITY_NAME is filled
while [ -z "$ENTITY_NAME" ]; do
  read -rp "Enter the friendly name for the entity (e.g., Illuminated Brick Game): " ENTITY_NAME
done

ENTITY_FULL_ID="${ENTITY_TYPE}.${ENTITY_ID}"
DIR_CONFIG="/config"
FILE_TEMPLATES="${DIR_CONFIG}/templates.yaml"

# Ensure entity does not already exist
ensure_file_exists "${FILE_TEMPLATES}"
if search_yaml_block "${FILE_TEMPLATES}" "${ENTITY_TYPE}" "${ENTITY_ID}"; then
  if ask_confirm "Entity ${ENTITY_FULL_ID} already exist. Do you want to override it?"; then
    echo "Entity ${ENTITY_FULL_ID} will be overriden: erasing existing entity..."
    remove_yaml_subblock templates.yaml "${ENTITY_TYPE}" "${ENTITY_ID}"
  else
    echo "Entity ${ENTITY_FULL_ID} will NOT be overriden: aborting..."
    exit 1
  fi
else
  echo "Entity ${ENTITY_FULL_ID} does not already exist: creating the entity..."
fi
