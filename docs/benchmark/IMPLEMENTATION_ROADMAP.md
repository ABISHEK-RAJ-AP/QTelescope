# Implementation roadmap — Releases A–E + sprints

**Date:** 2026-11-09  
Maps [ENTERPRISE_BENCHMARK_REPORT.md](ENTERPRISE_BENCHMARK_REPORT.md) to [../ENTERPRISE_MATURITY_PROGRAM.md](../ENTERPRISE_MATURITY_PROGRAM.md).

## Release overview

| Release | Theme | Priority band | Program sprints |
| --- | --- | --- | --- |
| **A** | Professional foundation | P0 | **S1–S3** (shipped lab) |
| **B** | Enterprise observability | P1 | **S4–S6** |
| **C** | Enterprise operations | P1 | **S7–S9** |
| **D** | Quantum intelligence | P2 | **S10–S11** |
| **E** | Advanced enterprise | P2–P3 | **S12–S14** |

---

## Release A — Professional foundation (P0) ✅ lab baseline

| Work item | Status | Evidence |
| --- | --- | --- |
| Design tokens + error/loading patterns | PARTIAL | tokens, Skeleton, route audit |
| Command palette (nav) | PARTIAL | `CommandPalette.jsx` |
| Request IDs + API errors | PASS | middleware + UI |
| Security hardening wave | PASS (lab) | SPRINT3_SECURITY |
| Playwright E01–E24 + gate script | PASS (lab) | E2E evidence, `run-e2e-telescope.sh` |
| Vitest unit infra | PASS | `npm test` |
| Prod env template | PASS | `.env.production.example` |

**Exit:** Checklist ≥33 PASS; QT-06 documented for go-live.

---

## Release B — Enterprise observability (P1)

**Sprint S4 (weeks 5–6)** — Pipelines & logs

- Unified **Logs Explorer** (read `audit_events` + structured app logs).
- **Collector execution** persistence + Platform Health UI (closes B07 partial).
- **Data quality report** per ingest cycle (API + admin widget).
- **Entity search** in command palette (backends, incidents, alerts).

**Sprint S5 (weeks 6–7)** — Metrics & catalogue

- **Metrics Explorer** v1 (saved queries, multi-backend, time compare).
- **Resource catalogue** v1 (extend inventory → owner, facility, tags).
- **Dependency map** v1 (collector → backend → alerts).
- Roll **EnterpriseDataTable** to jobs, alerts, calibration (per route audit).

**Sprint S6 (weeks 7–8)** — Reliability analytics

- **SLO definitions** + error budget chart (collector + API SLIs).
- **OpenTelemetry** traces for API + one collector path.
- **Synthetic probes** worker (health, auth, provider metadata).
- Visual regression + 9-viewport screenshot matrix (T05/T06).

**Release B acceptance:** [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) §B.

---

## Release C — Enterprise operations (P1)

**Sprint S7** — Alerting & notifications

- **Composite alert rules** (boolean DSL).
- **Notification centre** + routing (SMTP + webhook v1).
- Alert → log/metric drill-down links.

**Sprint S8** — Incidents & on-call

- Escalation policies, quiet hours, dedupe.
- Incident timeline + comms log + postmortem template.
- Shift handover page.

**Sprint S9** — Change & policy

- Configuration change history (admin deltas).
- Maintenance windows suppress correlation.
- **Policy engine** v1 (calibration freshness inheritance).
- Backup restore drill → QA evidence.

**Release C acceptance:** §C.

---

## Release D — Quantum intelligence (P2)

**Sprint S10**

- Calibration **revision diff** UI.
- Instruction/gate metric panels where data exists.
- Readiness **scorecard** per backend.

**Sprint S11**

- Benchmarking module (modality-gated).
- Workload–calibration reconstruction in replay.
- Facility correlation hardening.

**Release D acceptance:** §D.

---

## Release E — Advanced (P2–P3)

**Sprint S12–S14**

- Multi-facility RBAC.
- Integration developer centre.
- Workbooks / dashboard builder v2.
- Predictive analytics (only after D maturity).
- UAT sign-off package.

---

## Dependency graph (simplified)

```mermaid
flowchart LR
  A[S1-S3 Foundation] --> B[S4-S6 Observability]
  B --> C[S7-S9 Operations]
  B --> D[S10-S11 Quantum]
  C --> E[S12-S14 Enterprise]
  D --> E
```

## Anti-patterns (do not do)

- Add 20 pages before collector run history exists.  
- Ship SLO UI without SLI measurement jobs.  
- Copy CloudWatch pricing/scale assumptions.
