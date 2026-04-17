#!/usr/bin/env bash
set -euo pipefail
SESSION_DIR="${1:?Usage: start-board-server.sh <session-dir> [--idle-seconds N]}"; shift
IDLE_SEC="${IDLE_SEC:-1800}"
SERVER_JS="$(cd "$(dirname "$0")" && pwd)/server.cjs"
mkdir -p "$SESSION_DIR/state"
nohup node "$SERVER_JS" --session-dir "$SESSION_DIR" --idle-seconds "$IDLE_SEC" "$@" \
  > "$SESSION_DIR/state/server.log" 2>&1 &
echo "$!" > "$SESSION_DIR/state/server.pid"
# wait up to 5s for server-info
for i in $(seq 1 50); do
  [ -f "$SESSION_DIR/state/server-info" ] && break
  sleep 0.1
done
cat "$SESSION_DIR/state/server-info"
