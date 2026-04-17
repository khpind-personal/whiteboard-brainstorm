#!/usr/bin/env bash
set -euo pipefail
VERSION="0.17.6"
DEST="server/public/vendor"
mkdir -p "$DEST"
TMP=$(mktemp -d)
pushd "$TMP" > /dev/null
npm init -y > /dev/null
npm install --silent --no-save "@excalidraw/excalidraw@${VERSION}" react@18 react-dom@18
popd > /dev/null
cp "$TMP/node_modules/@excalidraw/excalidraw/dist/excalidraw.development.js" "$DEST/"
cp -r "$TMP/node_modules/@excalidraw/excalidraw/dist/excalidraw-assets" "$DEST/"
cp "$TMP/node_modules/react/umd/react.development.js" "$DEST/react.development.js"
cp "$TMP/node_modules/react-dom/umd/react-dom.development.js" "$DEST/react-dom.development.js"
rm -rf "$TMP"
echo "vendored @excalidraw/excalidraw@${VERSION}"
