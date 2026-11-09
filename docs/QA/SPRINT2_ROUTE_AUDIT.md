# Sprint 2 — route audit (28 protected + public)

**Date:** 2026-11-09  
**Goal:** Baseline each route for shell, loading, error, and table patterns before page-by-page migration.

Legend: **OK** = uses shared shell/skeleton/error; **MIX** = partial; **GAP** = missing pattern on primary path.

| Route | Component | Shell | Load | Error | Tables / forms | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Landing | — | — | — | — | Marketing |
| `/login` | LoginPage | AuthShell | btn | inline | AppForm via Field | `data-testid` on submit/error |
| `/register` | RegisterPage | AuthShell | btn | inline | Field | |
| `/forgot-password` | ForgotPasswordPage | AuthShell | btn | inline | Field | E04 journey |
| `/reset-password` | ResetPasswordPage | AuthShell | btn | inline | Field | |
| `/app/overview` | DashboardHome | PageHeader | BoneyardSkeleton | ErrorState | cards | `data-tour=page-kpis` |
| `/app/operate` | OperationsCentre | implicit | skeleton | partial | lane lists | |
| `/app/platform/health` | PlatformHealth | implicit | skeleton | ErrorState | **EnterpriseDataTable** | provider adapter table migrated |
| `/app/investigate/timeline` | OpsTimeline | implicit | skeleton | ErrorState | timeline | |
| `/app/backends/inventory` | BackendInventory | implicit | skeleton | ErrorState | cards/table | `data-tour=page-inventory` |
| `/app/backends/details/*` | BackendDetails | tabs | per-tab | ErrorState | mixed | workspace target |
| `/app/telemetry/live` | LiveTelemetry | implicit | skeleton | ErrorState | charts | SSE reconnect |
| `/app/telemetry/calibration` | CalibrationStatus | implicit | skeleton | ErrorState | table | |
| `/app/telemetry/drift` | DriftAnalysis | implicit | skeleton | ErrorState | table | |
| `/app/telemetry/trends` | HistoricalTrends | implicit | skeleton | ErrorState | table | |
| `/app/telemetry/topology` | TopologyExplorer | implicit | skeleton | ErrorState | graph + table | |
| `/app/telemetry/compare` | BackendComparison | implicit | skeleton | ErrorState | compare grid | |
| `/app/telemetry/anomalies` | AnomalyMonitor | implicit | skeleton | ErrorState | table | |
| `/app/telemetry/replay` | TemporalReplay | implicit | skeleton | ErrorState | table | |
| `/app/telemetry/metrics` | MetricsCoverage | implicit | skeleton | ErrorState | matrix | not EnterpriseDataTable |
| `/app/execution/jobs` | JobMonitoring | implicit | skeleton | ErrorState | DataPanelToolbar | reference table UX |
| `/app/execution/queues` | QueueMonitoring | implicit | skeleton | ErrorState | table | |
| `/app/resources/health` | ResourceHealth | implicit | skeleton | ErrorState | panels | |
| `/app/resources/environment` | EnvironmentPage | implicit | skeleton | ErrorState | cards | |
| `/app/resources/capabilities` | DeviceCapabilities | hero | skeleton | ErrorState | chips | |
| `/app/alerts` | AlertsEvents | implicit | skeleton | ErrorState | al-table | bulk actions |
| `/app/alerts/incidents` | AlertsEvents | implicit | skeleton | ErrorState | table | |
| `/app/reports` | ReportsPage | implicit | skeleton | ErrorState | table | |
| `/app/settings` | UserSettings | implicit | partial | toast | mixed fields | adopt AppFormField |
| `/app/admin/*` | AdministrationPage | implicit | skeleton | ErrorState | admin-table | |
| `/app/onboarding` | OnboardingFlow | wizard | step | inline | fields | |

## Sprint 2 shared artefacts

| Artefact | Path |
| --- | --- |
| Enterprise table shell | `frontend/src/components/observability/EnterpriseDataTable.jsx` |
| App form field | `frontend/src/components/forms/AppFormField.jsx` |
| Vitest | `frontend/vitest.config.js`, `npm test` |
| Playwright E01–E06 | `tests/e2e/telescope-journeys.spec.ts` |
| E2E captcha bypass (non-prod) | `E2E_CAPTCHA_BYPASS=1` + code `BYPASS` |

## Sprint 2 E2E catalog

All blueprint journeys **E01–E24** have Playwright specs under `tests/e2e/telescope-journeys*.spec.ts` (green VM run still required for T03 **PASS**).

## Next (Sprint 3)

1. Adopt `AppFormField` on Admin user/rule forms.
2. Console-error sweep F01 with Playwright route crawl.
3. Security blockers (Sprint 3 programme).
