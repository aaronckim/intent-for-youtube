#!/bin/sh
# Builds the Chrome Web Store upload: a zip of extension/ with manifest.json at its root.
set -e
cd "$(dirname "$0")/.."
version=$(node -p "require('./extension/manifest.json').version")
mkdir -p dist
rm -f "dist/intent-$version.zip"
(cd extension && zip -qrX "../dist/intent-$version.zip" . -x '.*' -x '*/.*')
echo "dist/intent-$version.zip"
unzip -l "dist/intent-$version.zip" | tail -n +2
