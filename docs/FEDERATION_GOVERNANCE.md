# Federation governance & trust boundaries (IMP-P6)

## Scope

National view = **local live DB aggregate** + **imported peer snapshots** (file or optional `aggregate_url`). There is **no live quantum mesh** between sites.

## Site identity

- Registry: `data/federation_registry.json` — `local_site_id`, `local_site_name`, peer list
- API: `GET /api/v1/federated/identity`

Peers must use stable `site_id` in every snapshot; filenames derive from `site_id`.

## Signing (HMAC-SHA256)

| Env | Meaning |
|-----|---------|
| `FEDERATION_SIGNING_KEY` | Shared secret (out-of-band between C-DAC hub and trusted labs) |
| `FEDERATION_REQUIRE_SIGNATURE=true` | Reject unsigned imports |

- Export signed local aggregate (Admin): `GET /api/v1/federated/local/export`
- Import: `POST /api/v1/federated/snapshots/import` (optional inline `signature`) or `POST .../import-signed` with `{payload, signature}`

**Trust model:** Anyone with Admin + valid signature (when required) can register peer totals. Signatures prove possession of the national signing secret — not non-repudiation at PKI level (upgrade path: Ed25519 in a future phase).

## Operational rules

1. Do not rank T1/T2 across `qpu_modality` in national totals (see aggregator disclaimer).
2. Peer snapshots are **aggregates only** — no raw qubit series in v1 federation.
3. Air-gap sites push snapshots via sneakernet into `data/federation_snapshots/` or Admin import.
4. `live_peer_mesh`: **NOT_BUILT** — do not label UI as real-time cross-site telemetry.

## C-DAC sign-off checklist (program)

- [ ] Signing key rotation procedure documented
- [ ] Peer site onboarding runbook (export → transfer → import → registry peer entry)
- [ ] Incident if signature mismatch on import
- [ ] National dashboard disclaimer visible (Operations Centre federated table)

See [NATIONAL_CHECKLIST_PHASE_MAP.md](../.planning/qtelescope-national/NATIONAL_CHECKLIST_PHASE_MAP.md).
