#!/usr/bin/env bash
set -euo pipefail
VAULT="${1:?Usage: restore-templates.sh <vault>}"
PLUGIN="$(cd "$(dirname "$0")/.." && pwd)"
for mode in preimpl general mindmap; do
  mkdir -p "$VAULT/30-Templates/$mode"
  cp "$PLUGIN/skills/whiteboard-brainstorm/templates/$mode/"*.excalidraw.json \
     "$VAULT/30-Templates/$mode/"
done
echo "restored templates into $VAULT"
