#!/usr/bin/env bash
# Symlink .agents/skills/* into .cursor/skills/ so Cursor discovers vendored skills.
# .cursor/ is gitignored; run after clone / skills refresh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/.cursor/skills"
shopt -s nullglob
for src in "$ROOT"/.agents/skills/*/; do
  name="$(basename "$src")"
  dest="$ROOT/.cursor/skills/$name"
  if [[ -e "$dest" && ! -L "$dest" ]]; then
    echo "KEEP (real dir) .cursor/skills/$name"
    continue
  fi
  ln -sfn "../../.agents/skills/$name" "$dest"
  echo "LINK $name"
done
echo "Done. Reload Cursor agent skills if needed."
