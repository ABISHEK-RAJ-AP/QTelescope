#!/usr/bin/env bash
# Install Mounir-Ghafir/design website/ rules into .cursor/skills/mounir-ux-website/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="${TMPDIR:-/tmp}/mounir-design-$$"
ZIP="${TMP}.zip"
VENDOR="$ROOT/.vendor/skills-upstream/mounir-ghafir-design"
RULES="$ROOT/.cursor/skills/mounir-ux-website/rules"

cleanup() { rm -rf "$TMP" "$ZIP"; }
trap cleanup EXIT

curl -fsSL -o "$ZIP" "https://github.com/Mounir-Ghafir/design/archive/refs/heads/main.zip"
mkdir -p "$TMP" "$VENDOR" "$RULES"
unzip -q -o "$ZIP" -d "$TMP"
SRC="$TMP/design-main"
[[ -d "$SRC/website" ]] || { echo "website/ missing in archive" >&2; exit 1; }

rsync -a --delete "$SRC/" "$VENDOR/"
rsync -a --delete "$SRC/website/" "$RULES/"

n=$(find "$RULES" -maxdepth 1 -name '*.md' | wc -l)
echo "OK: mounir-ux-website ($n rule files). Upstream: github.com/Mounir-Ghafir/design"
