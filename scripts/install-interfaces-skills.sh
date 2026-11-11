#!/usr/bin/env bash
# Install/refresh jakubkrehel/skills (interfaces.dev) into .cursor/skills/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="${TMPDIR:-/tmp}/jakub-skills-$$"
ZIP="${TMP}.zip"
DEST="$ROOT/.cursor/skills"
VENDOR="$ROOT/.vendor/skills-upstream/jakubkrehel-skills"

cleanup() { rm -rf "$TMP" "$ZIP"; }
trap cleanup EXIT

curl -fsSL -o "$ZIP" "https://github.com/jakubkrehel/skills/archive/refs/heads/main.zip"
mkdir -p "$TMP" "$VENDOR"
unzip -q -o "$ZIP" -d "$TMP"
SRC="$TMP/skills-main/skills"
[[ -d "$SRC" ]] || { echo "missing skills/ in archive" >&2; exit 1; }

mkdir -p "$VENDOR"
rsync -a --delete "$TMP/skills-main/" "$VENDOR/"

for name in afk better-accessibility better-colors better-interface better-layout better-typography better-ui better-writing break build-design explain-interface interface-review state-machine teardown variant; do
  rm -rf "$DEST/$name"
  cp -a "$SRC/$name" "$DEST/$name"
done

echo "OK: interfaces.dev skills installed ($(ls "$SRC" | wc -l) dirs). Attribution: MIT jakubkrehel/skills"
