# Q-TeleScope — API and Data Model Recommendations

**Re-verified SRC:** 24 routers, ~95 route handlers, OpenAPI **53 paths** (RUN)

---

## 1. API conventions (target)

| Concern | Current | Target |
|---------|---------|--------|
| Auth | None / optional header | Session cookie or Bearer validated every request |
| Errors | FastAPI default | `{code, message, correlation_id, details[]}` |
| Pagination | Ad hoc | `?limit=&cursor=` on jobs, alerts, telemetry history |
| Filtering | Query params vary | Standard `backend_id`, `status`, `since`, `until` |
| Version | `/api/v1` | Keep; deprecate policy in OpenAPI |

---

## 2. Endpoint matrix (summary)

Full list: OpenAPI `/api/v1/openapi.json` (RUN). Group recommendations:

| Router | Consumers (SRC api.js) | Gap | Recommendation |
|--------|------------------------|-----|----------------|
| auth | Login, Register | No session validate | Add `/auth/session`, `/auth/logout` |
| admin | AdministrationPage | Secrets unsafe | POST creds → vault; GET masked |
| events | LiveTelemetry | Misleading name | Rename description; optional `/events/stream/metadata` |
| health | ResourceHealth, compare | Quarantine advisory | Add `advisory: true` in response |
| incidents | AlertsEvents | No RBAC | Same as admin mutators |
| alerts | AlertsEvents, Dashboard | No RBAC | Operator ack |
| federated | OperationsCentre | Import only | Keep; document NOT live mesh |
| research | ReportsPage | Deterministic Q&A | Rename UI "Evidence lookup" |
| environment | EnvironmentPage | REST/inbox only | MQTT adapter Phase 5 |
| metrics | MetricsCoverage | None | Preserve |
| evidence | ReportsPage | Download unauth | AuthZ on download |

**No UI consumer (SRC):** `/admin/rbac-audit`, `/research/novelty-audit`, `/research/opportunities`, `/federated/status`, `/health/modules` (partial — health page uses modules). Expose in Platform Health admin tab.

---

## 3. Normalized telemetry record (proposed contract)

Aligned loosely with [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/) for naming discipline; quantum metrics remain domain-specific.

```json
{
  "metric_id": "qubit.t1",
  "value": 42.5,
  "unit": "us",
  "timestamp": "2026-10-31T12:00:00Z",
  "observed_at": "2026-10-31T11:58:00Z",
  "provider_id": "ibm_quantum",
  "site_id": "local",
  "backend_id": "ibm_brisbane",
  "resource": {"type": "qubit", "index": 0},
  "calibration_id": "cal-2026-10-30",
  "quality": "VALID",
  "provenance": "live:ibm",
  "collection_run_id": "uuid"
}
```

Implement as view layer first; persist `collection_run_id` on telemetry tables Phase 4.

---

## 4. Database model changes (staged)

### Phase 0–1 (minimal)

| Change | Rationale |
|--------|-----------|
| `users` table | Replace `data/registered_users.json` |
| `audit_events` | Security + quarantine + cred changes |
| `sessions` | Server-side session store |

### Phase 4

| Change | Rationale |
|--------|-----------|
| `telemetry_retention_policy` | Configurable purge |
| `collection_runs` | Pipeline traceability |
| `failed_collections` | DLQ for collector errors |
| Index `(backend_id, timestamp DESC)` on qubit_telemetry | Query perf |

### Defer unless volume proves need

- TimescaleDB / separate TSDB — evaluate after retention metrics on PostgreSQL.

---

## 5. Zero Trust alignment

Per [NIST SP 800-207](https://csrc.nist.gov/pubs/sp/800/207/final): verify explicitly on every request; no trust from network location or hidden Admin nav (**SRC** current gap).

---

## 6. Provider credential storage

| Option | Phase |
|--------|-------|
| Encrypted columns + KMS | Phase 0 prod |
| HashiCorp Vault / K8s secrets | National deploy |
| Never write raw token to `.env` from API | Phase 0 |

Current: `_update_env_file` in `admin.py` (**SRC**) — **replace**.
