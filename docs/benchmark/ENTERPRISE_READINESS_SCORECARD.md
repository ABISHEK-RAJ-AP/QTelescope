# Enterprise readiness scorecard

**Date:** 2026-11-09 · **Not a production certificate** — evidence-based maturity snapshot.

Scale: **0** absent · **1** prototype · **2** partial · **3** production-suitable with tests · **4** benchmark-aligned

| Dimension | Score | Rationale | Next milestone |
| --- | ---: | --- | --- |
| 1. Monitoring & observability | 2 | Strong pages; weak explorer/SLO | Release B |
| 2. Fleet & resources | 2 | Inventory; no catalogue/owners | S5 catalogue |
| 3. Telemetry pipelines | 2 | Collectors work; no pipeline UX | S4 collector runs |
| 4. Alerts & correlation | 2 | Alerts/incidents; no composite | S7 |
| 5. Automation & intelligence | 1 | Limited runbooks | S8–S9 |
| 6. Security & governance | 2 | S3 lab; SSO/policy gaps | VM + SSO |
| 7. Dashboards & UX | 2 | Solid shell; inconsistent grid | S4–S6 |
| 8. Evidence & analytics | 2 | Reports/snapshots; signing partial | S9 retention |
| 9. Integrations | 2 | Multi-provider; no dev centre | Release E |
| 10. Deployment & reliability | 1 | No SLO/OTel shipped | S6 synthetic |

**Average:** **1.9 / 4** (enterprise control plane **foundation**, not full operations plane).

## Product area maturity (Part VIII vision)

| Area | Score | Notes |
| --- | ---: | --- |
| Quantum Observability | 2.5 | Core routes + IBM-like depth missing |
| Resource Management | 2 | Inventory only |
| Operations & Reliability | 1.5 | Incidents exist; IRM missing |
| Data & Evidence | 2 | Snapshots; pipeline QA weak |
| Governance & Security | 2 | RBAC/MFA; policy engine missing |
| Platform Administration | 2 | Admin collectors; history gap |

## Checklist crosswalk

| Metric | Value |
| --- | --- |
| Master checklist PASS | **33 / 93** |
| PARTIAL (backlog) | **26** (mostly Release B–E) |
| FAIL | **5** (retention, quality enum, correlation, B05/B07/T13) |
| Open P1 defect | **QT-06** (demo secrets) |

## Recommended next 90 days

1. **S4:** Logs Explorer + collector execution history + data quality API.  
2. **S5:** Metrics Explorer v1 + resource owner fields.  
3. **S6:** SLO v1 + synthetic probes + visual baselines.  
4. VM: repeat E2E + SMTP + rotated secrets.

Update this scorecard when a release acceptance section in [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) is fully green.
