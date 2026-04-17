#!/usr/bin/env bash
set -euo pipefail
VAULT="${1:?Usage: export-to-png.sh <vault> <slug>}"
SLUG="${2:?Usage: export-to-png.sh <vault> <slug>}"
BOARD="$VAULT/20-Canvases/$SLUG/latest.excalidraw.json"
OUT="$VAULT/20-Canvases/$SLUG/latest.png"
[ -f "$BOARD" ] || { echo "missing: $BOARD" >&2; exit 2; }
node "$(dirname "$0")/_render-png.js" "$BOARD" "$OUT"
echo "wrote $OUT"
