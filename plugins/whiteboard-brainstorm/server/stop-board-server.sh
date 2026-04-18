#!/usr/bin/env bash
set -euo pipefail
SESSION_DIR="${1:?Usage: stop-board-server.sh <session-dir>}"
PID_FILE="$SESSION_DIR/.state/server.pid"
[ -f "$PID_FILE" ] && kill "$(cat "$PID_FILE")" 2>/dev/null || true
rm -f "$PID_FILE" "$SESSION_DIR/.state/server-info"
