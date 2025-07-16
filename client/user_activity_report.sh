#!/bin/bash

AUTH_FILE="/config/.storage/auth"

if [[ ! -f "$AUTH_FILE" ]]; then
  echo "[ERR] Auth file not found at $AUTH_FILE"
  exit 1
fi

# Columns and default sorting
declare -a COLUMNS=("Name" "User ID" "First Created At" "Last Used At" "Client ID")
SORT_COL="${1:-First Created At}"
SORT_ORDER="${2:-ascending}"

# Validate sort order
if [[ "$SORT_ORDER" != "ascending" && "$SORT_ORDER" != "descending" ]]; then
  echo "[ERR] Invalid sort order: $SORT_ORDER (use 'ascending' or 'descending')"
  exit 1
fi

# Find sort column index
sort_index=-1
for i in "${!COLUMNS[@]}"; do
  if [[ "${COLUMNS[$i]}" == "$SORT_COL" ]]; then
    sort_index=$i
    break
  fi
done

if [[ $sort_index -eq -1 ]]; then
  echo "[ERR] Invalid sort column: $SORT_COL"
  echo "Valid columns: ${COLUMNS[*]}"
  exit 1
fi

jq_program=$(cat <<'EOF'
.data as $data
| $data.users[]
| select(.is_active == true) as $user
| {
    name: $user.name,
    id: $user.id,
    created: ($data.refresh_tokens | map(select(.user_id == $user.id)) | map(.created_at) | sort | .[0] // "-"),
    last: ($data.refresh_tokens | map(select(.user_id == $user.id)) | map(select(.last_used_at != null)) | sort_by(.last_used_at) | last)
  }
| {
    name,
    id,
    created_at: .created,
    last_used_at: (.last.last_used_at // "-"),
    client_id: (.last.client_id // "-")
  }
EOF
)

# Extract data as TSV (tab-separated values)
data=$(jq -r "$jq_program | [.name, .id, .created_at, .last_used_at, .client_id] | @tsv" "$AUTH_FILE")

# Prepare array for all rows including header
rows=()
rows+=("$(IFS=$'\t'; echo "${COLUMNS[*]}")")  # header as TSV
while IFS= read -r line; do
  rows+=("$line")
done <<< "$data"

# Calculate max width per column
cols=${#COLUMNS[@]}
max_widths=()
for (( c=0; c<cols; c++ )); do
  max=0
  for row in "${rows[@]}"; do
    # Extract the c-th field (tab-separated)
    field=$(echo -e "$row" | cut -f $((c+1)))
    len=${#field}
    (( len > max )) && max=$len
  done
  max_widths+=($max)
done

# date to epoch helper function (same as before)
date_to_epoch() {
  clean=$(echo "$1" | sed -E 's/\.[0-9]+//; s/T/ /; s/\+00:00//')
  date -d "$clean" +%s 2>/dev/null || echo 0
}

# Print header row with calculated widths
format=""
for w in "${max_widths[@]}"; do
  format+="%-${w}s "
done
printf "${format}\n" "${COLUMNS[@]}"

# Create temp file for sorting keyed rows
tmpfile=$(mktemp)
for (( i=1; i<${#rows[@]}; i++ )); do
  IFS=$'\t' read -r name id created_at last_used_at client_id <<< "${rows[$i]}"
  case $sort_index in
    0) sort_key=$(echo "$name" | tr '[:upper:]' '[:lower:]') ;;
    1) sort_key=$(echo "$id" | tr '[:upper:]' '[:lower:]') ;;
    2) [[ "$created_at" == "-" ]] && sort_key=0 || sort_key=$(date_to_epoch "$created_at") ;;
    3) [[ "$last_used_at" == "-" ]] && sort_key=0 || sort_key=$(date_to_epoch "$last_used_at") ;;
    4) sort_key=$(echo "$client_id" | tr '[:upper:]' '[:lower:]') ;;
    *) sort_key="" ;;
  esac
  echo -e "${sort_key}\t${name}\t${id}\t${created_at}\t${last_used_at}\t${client_id}"
done > "${tmpfile}.keyed"

# Sort by key
if [[ "$sort_index" -eq 2 || "$sort_index" -eq 3 ]]; then
  if [[ "$SORT_ORDER" == "ascending" ]]; then
    sort -n -k1,1 "${tmpfile}.keyed"
  else
    sort -nr -k1,1 "${tmpfile}.keyed"
  fi
else
  if [[ "$SORT_ORDER" == "ascending" ]]; then
    sort -k1,1 "${tmpfile}.keyed"
  else
    sort -r -k1,1 "${tmpfile}.keyed"
  fi
fi > "${tmpfile}.sorted"

# Print sorted rows with dynamic widths
while IFS=$'\t' read -r _sort_key name id created_at last_used_at client_id; do
  printf "${format}\n" "$name" "$id" "$created_at" "$last_used_at" "$client_id"
done < "${tmpfile}.sorted"

# Cleanup
rm -f "$tmpfile" "${tmpfile}.keyed" "${tmpfile}.sorted"
