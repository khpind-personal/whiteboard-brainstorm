#!/usr/bin/env bash
set -euo pipefail
SESSION_DIR="${1:?Usage: start-board-server.sh <session-dir> [--foreground] [--idle-seconds N]}"; shift
IDLE_SEC="${IDLE_SEC:-1800}"
SERVER_JS="$(cd "$(dirname "$0")" && pwd)/server.cjs"
FOREGROUND=0
ARGS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --foreground) FOREGROUND=1 ;;
    *) ARGS+=("$1") ;;
  esac
  shift
done
mkdir -p "$SESSION_DIR/.state"
rm -f "$SESSION_DIR/.state/server-info" "$SESSION_DIR/.state/server-stopped"
if [ "$FOREGROUND" -eq 1 ]; then
  exec node "$SERVER_JS" --session-dir "$SESSION_DIR" --idle-seconds "$IDLE_SEC" "${ARGS[@]}"
fi
nohup node "$SERVER_JS" --session-dir "$SESSION_DIR" --idle-seconds "$IDLE_SEC" "${ARGS[@]}" \
  > "$SESSION_DIR/.state/server.log" 2>&1 &
echo "$!" > "$SESSION_DIR/.state/server.pid"
for i in $(seq 1 50); do
  [ -f "$SESSION_DIR/.state/server-info" ] && break
  if ! kill -0 "$(cat "$SESSION_DIR/.state/server.pid")" 2>/dev/null; then
    cat "$SESSION_DIR/.state/server.log" >&2
    exit 1
  fi
  sleep 0.1
done
if [ ! -f "$SESSION_DIR/.state/server-info" ]; then
  cat "$SESSION_DIR/.state/server.log" >&2
  exit 1
fi
cat "$SESSION_DIR/.state/server-info"
