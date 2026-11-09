#!/usr/bin/env bash
# Refresh dashboard agent skills from .vendor/skills-upstream into .cursor/skills/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UP="$ROOT/.vendor/skills-upstream"

for repo in dashboard-design-skill awesome-dashboard-skill; do
  if [[ -d "$UP/$repo/.git" ]]; then
    git -C "$UP/$repo" pull --ff-only
  fi
done

rm -rf "$ROOT/.cursor/skills/dashboard-design" "$ROOT/.cursor/skills/awesome-dashboard-skill"
cp -a "$UP/dashboard-design-skill/skills/dashboard-design" "$ROOT/.cursor/skills/dashboard-design"
rsync -a --exclude='.git' "$UP/awesome-dashboard-skill/" "$ROOT/.cursor/skills/awesome-dashboard-skill/"

echo "OK: dashboard-design + awesome-dashboard-skill refreshed in .cursor/skills/"
