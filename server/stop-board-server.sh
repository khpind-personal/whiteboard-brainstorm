#!/usr/bin/env bash
set -euo pipefail
SESSION_DIR="${1:?Usage: stop-board-server.sh <session-dir>}"
PID_FILE="$SESSION_DIR/.state/server.pid"
INFO_FILE="$SESSION_DIR/.state/server-info"
PID=""
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"
elif [ -f "$INFO_FILE" ]; then
  PID="$(node -e "try{const fs=require('fs'); console.log(JSON.parse(fs.readFileSync(process.argv[1],'utf8')).pid || '')}catch{process.exit(0)}" "$INFO_FILE")"
fi
[ -n "$PID" ] && kill "$PID" 2>/dev/null || true
rm -f "$PID_FILE" "$SESSION_DIR/.state/server-info"
