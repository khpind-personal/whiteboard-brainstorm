#!/usr/bin/env bash
set -euo pipefail
VAULT="${1:?Usage: export-to-png.sh <vault> <slug> [out-path]}"
SLUG="${2:?Usage: export-to-png.sh <vault> <slug> [out-path]}"
OUT="${3:-}"
PLUGIN="$(cd "$(dirname "$0")/.." && pwd)"
node "$PLUGIN/bin/wbb.js" export-png "$VAULT" "$SLUG" "$OUT"
