# Q-TeleScope UI Redesign — Sprint 4 Report

**Date:** 2026-10-31  
**Scope:** Backend inventory, backend details, qubit monitoring, backend comparison.

## 1. Summary

Fleet pages now align with observability honesty rules: **no inferred topology or fabricated facility telemetry**, API-backed **modality_extensions** and **classical infra** on details, tighter **inventory filters**, **qubit search + paging**, and **comparison guardrails** before/after `POST /health/compare`. Backend details tabs reduced from seven to five (removed empty gates tab; merged queue + jobs into **execution**; wired **calibration** to snapshot API).

## 2. Files modified

| File | Change |
|------|--------|
| `frontend/src/pages/BackendInventory.jsx` | Status filter, result count, topology from API only, empty filter state |
| `frontend/src/pages/BackendDetails.jsx` | API modality panel; calibration tab; execution tab; connectivity honesty |
| `frontend/src/pages/QubitMonitoring.jsx` | Search, pagination (40/page), ChartPanel + chart theme |
| `frontend/src/pages/BackendComparison.jsx` | InfoTooltip guardrails, pre-compare modality warning, EmptyState paths |

## 3. Components reused

`EmptyState`, `ChartPanel`, `DataSourceBadge`, `InfoTooltip`, `baseTooltip` / `getChartTheme`, `useTheme`.

## 4. APIs

| Page | Endpoints |
|------|-----------|
| Inventory | `GET /backends` |
| Details | `GET /backends/{id}`, status, qubits, calibration, connectivity, jobs, queue; classical infra when C-DAC |
| Qubits | `GET /backends/{id}/qubits`, qubit history |
| Compare | `GET /backends`, `POST /health/compare` |

## 5. Data gaps (unchanged)

- No fleet availability time series on inventory.
- Large qubit arrays: **client paging only** (no virtualization).
- Compare ranking still API-gated on same `qpu_modality`.

## 6. Honesty fixes

- Removed hardcoded UHV/laser/cryo marketing tiles from backend overview.
- Inventory no longer guesses Heavy-Hex vs planar from qubit count.

## 7. Tests

| Check | Result |
|-------|--------|
| pytest | **84 passed** |
| npm run build | **OK** |

## 8. Known issues

- Backend header subtitle still uses modality **labels** (not numeric telemetry).
- Connectivity tab shows edge count only (no graph widget yet).

---

**Stopped for review.** Next: **Sprint 5** — telemetry, drift, trends, calibration timeline.
