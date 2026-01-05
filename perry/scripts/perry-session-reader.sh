#!/bin/bash
set -e

STORAGE_BASE="${HOME}/.local/share/opencode/storage"
SESSION_DIR="${STORAGE_BASE}/session"
MESSAGE_DIR="${STORAGE_BASE}/message"
PART_DIR="${STORAGE_BASE}/part"

usage() {
  echo "Usage: $0 <command> [args]"
  echo "Commands:"
  echo "  list                    List all sessions (JSON array)"
  echo "  messages <session_id>   Get all messages for a session (JSON)"
  exit 1
}

list_sessions() {
  local sessions="[]"

  for project_dir in "${SESSION_DIR}"/*; do
    [ -d "$project_dir" ] || continue

    for session_file in "${project_dir}"/ses_*.json; do
      [ -f "$session_file" ] || continue

      local mtime=$(stat -c %Y "$session_file" 2>/dev/null || stat -f %m "$session_file" 2>/dev/null)
      local data=$(cat "$session_file")
      local id=$(echo "$data" | jq -r '.id // empty')
      local title=$(echo "$data" | jq -r '.title // empty')
      local directory=$(echo "$data" | jq -r '.directory // empty')
      local updated=$(echo "$data" | jq -r '.time.updated // empty')

      [ -z "$id" ] && continue

      local session_json=$(jq -n \
        --arg id "$id" \
        --arg title "$title" \
        --arg directory "$directory" \
        --arg mtime "${updated:-$mtime}" \
        --arg file "$session_file" \
        '{id: $id, title: $title, directory: $directory, mtime: ($mtime | tonumber), file: $file}')

      sessions=$(echo "$sessions" | jq --argjson s "$session_json" '. + [$s]')
    done
  done

  echo "$sessions"
}

get_messages() {
  local session_id="$1"
  [ -z "$session_id" ] && { echo '{"error": "session_id required"}'; exit 1; }

  local session_file=$(find "$SESSION_DIR" -name "${session_id}.json" -type f 2>/dev/null | head -1)
  [ -z "$session_file" ] && { echo '{"error": "session not found"}'; exit 1; }

  local internal_id=$(jq -r '.id // empty' "$session_file")
  [ -z "$internal_id" ] && { echo '{"error": "invalid session file"}'; exit 1; }

  local msg_dir="${MESSAGE_DIR}/${internal_id}"
  [ -d "$msg_dir" ] || { echo '{"id": "'"$session_id"'", "messages": []}'; exit 0; }

  local messages="[]"

  for msg_file in $(ls -1 "${msg_dir}"/msg_*.json 2>/dev/null | sort); do
    [ -f "$msg_file" ] || continue

    local msg=$(cat "$msg_file")
    local msg_id=$(echo "$msg" | jq -r '.id // empty')
    local role=$(echo "$msg" | jq -r '.role // empty')
    local created=$(echo "$msg" | jq -r '.time.created // empty')

    [ -z "$msg_id" ] && continue
    [[ "$role" != "user" && "$role" != "assistant" ]] && continue

    local part_msg_dir="${PART_DIR}/${msg_id}"
    [ -d "$part_msg_dir" ] || continue

    for part_file in $(ls -1 "${part_msg_dir}"/prt_*.json 2>/dev/null | sort); do
      [ -f "$part_file" ] || continue

      local part=$(cat "$part_file")
      local part_type=$(echo "$part" | jq -r '.type // empty')

      if [ "$part_type" = "text" ]; then
        local text=$(echo "$part" | jq -r '.text // empty')
        [ -z "$text" ] && continue

        local entry=$(jq -n \
          --arg type "$role" \
          --arg content "$text" \
          --arg ts "$created" \
          '{type: $type, content: $content, timestamp: (if $ts != "" then ($ts | tonumber / 1000 | todate) else null end)}')
        messages=$(echo "$messages" | jq --argjson e "$entry" '. + [$e]')

      elif [ "$part_type" = "tool" ]; then
        local tool=$(echo "$part" | jq -r '.tool // empty')
        local call_id=$(echo "$part" | jq -r '.callID // .id // empty')
        local title=$(echo "$part" | jq -r '.state.title // empty')
        local input=$(echo "$part" | jq '.state.input // null')
        local output=$(echo "$part" | jq -r '.state.output // empty')

        local tool_use=$(jq -n \
          --arg type "tool_use" \
          --arg toolName "${title:-$tool}" \
          --arg toolId "$call_id" \
          --argjson toolInput "$input" \
          --arg ts "$created" \
          '{type: $type, toolName: $toolName, toolId: $toolId, toolInput: ($toolInput | tostring), timestamp: (if $ts != "" then ($ts | tonumber / 1000 | todate) else null end)}')
        messages=$(echo "$messages" | jq --argjson e "$tool_use" '. + [$e]')

        if [ -n "$output" ]; then
          local tool_result=$(jq -n \
            --arg type "tool_result" \
            --arg content "$output" \
            --arg toolId "$call_id" \
            --arg ts "$created" \
            '{type: $type, content: $content, toolId: $toolId, timestamp: (if $ts != "" then ($ts | tonumber / 1000 | todate) else null end)}')
          messages=$(echo "$messages" | jq --argjson e "$tool_result" '. + [$e]')
        fi
      fi
    done
  done

  jq -n --arg id "$session_id" --argjson messages "$messages" '{id: $id, messages: $messages}'
}

case "${1:-}" in
  list) list_sessions ;;
  messages) get_messages "$2" ;;
  *) usage ;;
esac
