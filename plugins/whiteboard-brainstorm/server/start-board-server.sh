#!/usr/bin/env bash
set -euo pipefail
SESSION_DIR="${1:?Usage: start-board-server.sh <session-dir> [--idle-seconds N]}"; shift
IDLE_SEC="${IDLE_SEC:-1800}"
SERVER_JS="$(cd "$(dirname "$0")" && pwd)/server.cjs"
mkdir -p "$SESSION_DIR/.state"
rm -f "$SESSION_DIR/.state/server-info" "$SESSION_DIR/.state/server-stopped"
nohup node "$SERVER_JS" --session-dir "$SESSION_DIR" --idle-seconds "$IDLE_SEC" "$@" \
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
