#!/usr/bin/env bash
# Build frontend, run smoke tests, pack trimmed VM zip (no agent/AI markdown trees).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
DATE_TAG="$(date +%Y%m%d)"
REV="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
OUT="${1:-$HOME/Desktop/Q-TeleScope-vm-${DATE_TAG}-${REV}.zip}"
STAGE="$(mktemp -d)"
NAME="Q-TeleScope"
DEST="$STAGE/$NAME"

RSYNC_EX=(
  -a
  --exclude='.git'
  --exclude='node_modules'
  --exclude='.venv'
  --exclude='venv'
  --exclude='__pycache__'
  --exclude='.pytest_cache'
  --exclude='.env'
  --exclude='.env.*'
  --exclude='*.log'
  --exclude='.pgdata'
  --exclude='.redis-data'
)

echo "==> Frontend production build"
if command -v npm >/dev/null; then
  (cd "$ROOT/frontend" && npm ci && npm run build)
else
  echo "npm missing — using existing frontend/dist if present" >&2
fi
test -f "$ROOT/frontend/dist/index.html" || { echo "FAIL: frontend/dist/index.html missing" >&2; exit 1; }

echo "==> Backend smoke tests"
python3 -m pytest tests/test_registration_org_owner.py tests/test_self_registration.py \
  tests/test_public_registration.py -q --tb=no

mkdir -p "$DEST"
for d in app alembic config deployment; do
  [[ -d "$ROOT/$d" ]] && rsync "${RSYNC_EX[@]}" "$ROOT/$d/" "$DEST/$d/"
done
rsync "${RSYNC_EX[@]}" "$ROOT/backend/" "$DEST/backend/"
rsync "${RSYNC_EX[@]}" \
  --exclude='src' \
  --exclude='public' \
  --exclude='*.config.js' \
  --exclude='package-lock.json' \
  "$ROOT/frontend/" "$DEST/frontend/" 2>/dev/null || true
# Include dist + package manifest for optional rebuild
rsync -a "$ROOT/frontend/dist/" "$DEST/frontend/dist/"
for f in package.json vite.config.js index.html; do
  [[ -f "$ROOT/frontend/$f" ]] && cp "$ROOT/frontend/$f" "$DEST/frontend/"
done

mkdir -p "$DEST/data"
touch "$DEST/data/.gitkeep"
[[ -f "$ROOT/data/governance_reservations.json" ]] && cp "$ROOT/data/governance_reservations.json" "$DEST/data/" 2>/dev/null || true

mkdir -p "$DEST/scripts/lib"
for f in setup-nginx-host.sh vm-event-public-demo.sh vm-event-restart.sh vm-demo-env.sh \
  vm-vapt-restart.sh verify-stack.sh diagnose-demo-stack.sh seed_demo_fleet.py \
  refresh_demo_fleet.py migrate_sqlite_to_postgres.py backup_sqlite.sh run-backend.sh; do
  [[ -f "$ROOT/scripts/$f" ]] && cp "$ROOT/scripts/$f" "$DEST/scripts/"
done
[[ -d "$ROOT/scripts/lib" ]] && rsync "${RSYNC_EX[@]}" "$ROOT/scripts/lib/" "$DEST/scripts/lib/"

for f in alembic.ini LICENSE .env.example; do
  [[ -f "$ROOT/$f" ]] && cp "$ROOT/$f" "$DEST/"
done

cp "$ROOT/deployment/VM-README.md" "$DEST/README.md"
cp "$ROOT/deployment/vm-setup.sh" "$DEST/setup.sh"
chmod +x "$DEST/setup.sh"

cat >"$DEST/VERSION.txt" <<EOF
Q-TeleScope VM bundle
Git: $REV
Built: $(date -Iseconds)
EOF

# Strip stray markdown / agent files
find "$DEST" -type f \( -name 'SKILL.md' -o -name 'AGENTS.md' -o -name 'CLAUDE.md' \) -delete 2>/dev/null || true
find "$DEST" -type d \( -name '.cursor' -o -name '.agents' -o -name 'graphify-out' \) -prune -exec rm -rf {} + 2>/dev/null || true

python3 - "$STAGE/$NAME" "$OUT" <<'PY'
import os, sys, zipfile
src_root, out_path = sys.argv[1], sys.argv[2]
skip_dirs = {".cursor", ".agents", ".planning", "graphify-out", "node_modules", ".venv", "venv", "__pycache__"}
with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for dirpath, dirnames, filenames in os.walk(src_root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for fn in filenames:
            if fn.endswith((".md", ".MD")) and fn not in ("README.md",):
                continue
            if fn in ("SKILL.md", "AGENTS.md", "CLAUDE.md"):
                continue
            full = os.path.join(dirpath, fn)
            arc = os.path.relpath(full, os.path.dirname(src_root))
            zf.write(full, arc)
PY

rm -rf "$STAGE"
echo "Created: $OUT"
du -h "$OUT"