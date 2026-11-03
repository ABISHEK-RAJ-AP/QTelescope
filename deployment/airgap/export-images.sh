#!/usr/bin/env bash
# Build and export container images for offline transfer (run on connected build host).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
OUT="${1:-deployment/airgap/offline-images}"
mkdir -p "$OUT"

echo "Building stack..."
docker compose -f docker-compose.yml -f docker-compose.airgap.yml build

BACKEND_ID="$(docker compose -f docker-compose.yml -f docker-compose.airgap.yml images -q backend)"
FRONT_ID="$(docker compose -f docker-compose.yml -f docker-compose.airgap.yml images -q frontend)"

echo "Saving images to ${OUT}..."
docker save -o "${OUT}/qtelescope-backend.tar" "$BACKEND_ID"
docker save -o "${OUT}/qtelescope-frontend.tar" "$FRONT_ID"

cat > "${OUT}/LOAD_IMAGES.txt" <<'EOF'
On the air-gapped host:
  docker load -i qtelescope-backend.tar
  docker load -i qtelescope-frontend.tar
Then tag/load compose project or use compose with image IDs per your site policy.
EOF

echo "Done. Transfer ${OUT}/*.tar via approved media."
