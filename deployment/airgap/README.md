# On-prem / air-gap deployment bundle

## Quick start (single connected lab LAN)

```bash
cp deployment/airgap/.env.airgap.example .env
./deployment/airgap/preflight.sh
docker compose -f docker-compose.yml -f docker-compose.airgap.yml up -d --build
```

- UI: http://localhost  
- API: http://localhost:8000/docs  
- Profile: `GET /api/v1/admin/deployment/profile`

## Air-gap constraints

| Capability | Air-gap |
|------------|---------|
| Cloud vendor APIs | Policy blocked (`AIRGAP_MODE=true`) |
| On-prem / PARAM adapter | `ONPREM_QPU_URL` |
| Facility ingest | REST + `data/facility_inbox/` |
| Federation peers | `data/federation_snapshots/` |
| MQTT facility | NOT_BUILT |

## Offline image transfer

On a build machine with registry access:

```bash
./deployment/airgap/export-images.sh
```

Copy `deployment/airgap/offline-images/*.tar` to the isolated site and `docker load` per `LOAD_IMAGES.txt`.

## Data volume

`docker-compose.airgap.yml` mounts `qtelescope_data` at `/app/data` (SQLite, evidence, federation, environment JSON).

See also: [docs/DEPLOYMENT_AIRGAP.md](../../docs/DEPLOYMENT_AIRGAP.md), `.planning/qtelescope-national/DEPLOYMENT_ARCHITECTURE.md`.
