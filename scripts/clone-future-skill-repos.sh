#!/usr/bin/env bash
# Optional shallow clones for Cursor agents — never copied into frontend/package.json
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UP="$ROOT/.vendor/skills-upstream"
mkdir -p "$UP"

clone() {
  local name="$1" url="$2"
  if [[ -d "$UP/$name/.git" ]]; then
    echo "skip $name (exists)"
  else
    git clone --depth 1 "$url" "$UP/$name"
  fi
}

clone lenis https://github.com/darkroomengineering/lenis.git
clone moveable https://github.com/daybrush/moveable.git
clone perfect-freehand https://github.com/steveruizok/perfect-freehand.git
# taste-skill is large; clone only when doing marketing:
# clone taste-skill https://github.com/Leonxlnx/taste-skill.git

echo "OK: future-reference repos under $UP"
