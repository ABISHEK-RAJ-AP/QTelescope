# Deployment — air-gap / on-prem

National institute sites often block outbound cloud QPU APIs. Use **air-gap profile**:

1. Set `AIRGAP_MODE=true` (see `deployment/airgap/.env.airgap.example`).
2. Point `ONPREM_QPU_URL` at the local PARAM / lab controller.
3. Import facility JSON and federation peer snapshots under `data/`.
4. Optional: transfer pre-built images via `deployment/airgap/export-images.sh`.

Verify runtime:

```bash
curl -s http://localhost:8000/api/v1/admin/deployment/profile | jq .
```

Expect `"profile": "airgap_onprem"` and `vendor_cloud_poll: DISABLED_IN_AIRGAP`.

PostgreSQL overlay still works: add `-f docker-compose.postgres.yml --profile postgres` when site policy requires it.
