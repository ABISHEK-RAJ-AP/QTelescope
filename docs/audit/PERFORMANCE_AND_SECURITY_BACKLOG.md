# Performance & security programme (Q-TeleScope)

Maps the operator “harden everything” list to **status**, **owner**, and **next action**. Not a release sign-off — see [MASTER_RELEASE_CHECKLIST.md](../QA/MASTER_RELEASE_CHECKLIST.md).

## Legend

| Status | Meaning |
| --- | --- |
| **DONE** | In repo today |
| **P0** | Ship next in-app |
| **P1** | This milestone |
| **INFRA** | Deploy / CDN / LB — not app-only |
| **OPEN** | Needs design or audit |

## Frontend UX & performance

| Item | Status | Notes |
| --- | --- | --- |
| Animated KPI / delta numbers | **P0→DONE** | `AnimatedNumber` + `ExceptionStrip`; Alerts/Dashboard/Anomaly KPIs |
| Debounce search / autocomplete | **P0→DONE** | `useDebouncedValue` on Ops timeline, Alerts, Admin users |
| Skeleton (boneyard) on load | **P1→DONE (slice)** | AddBackendWizard provider load + major routes covered |
| No duplicate alert polling | **DONE** | `AlertsSummaryContext` — single `/alerts/summary` coalescer; Alerts page syncs counts from list |
| Optimistic UI before server | **P1→DONE (slice)** | Alert ack/resolve + admin role assign |
| Lazy-load below-fold images | **DONE** | `LazyImage` component (`loading=lazy`) |
| Split JS by route | **DONE** | React lazy routes in `App.jsx` |
| Lazy-load ECharts runtime | **P0→DONE** | `QtECharts` Suspense + dynamic `echarts-for-react` (~1.1MB async chunk) |
| Virtualize long lists | **P1→DONE (EDT)** | Client paginate via `EnterpriseDataTable`; alerts server load-more |
| Prevent unnecessary re-renders | **OPEN** | Profile hot paths after OTel; OperationsCentre hooks + staged load fixed 2026-11-09 |
| Self-host fonts / limit weights | **P1→DONE (weights)** | Trimmed Google Fonts weights in `index.css`; full self-host = INFRA |
| WebP/AVIF assets | **OPEN** | Build pipeline + `<picture>` when static art grows |

## Backend & data

| Item | Status | Notes |
| --- | --- | --- |
| GZip response compression | **DONE** | `GZipMiddleware` in `app/main.py` |
| Brotli | **DONE (doc)** | [`docs/deployment/EDGE_CDN_COMPRESSION.md`](../deployment/EDGE_CDN_COMPRESSION.md) |
| Paginate API results | **P1→DONE (alerts)** | UI “Load more” via `offset`; KPIs from `/alerts/summary` |
| Fix N+1 queries | **P1→DONE (slice)** | Incident list batch counts; provenance `load_only` |
| DB indexes | **DONE** | `20261109_0016` + prior `20261102_0005` |
| Connection pooling | **DONE** | SQLAlchemy pool in `app/core/database.py` |
| Cache hot reads | **P1→DONE (slice)** | `platform-health` TTL + memory/redis via `get_or_set_json` |
| External API timeouts | **DONE** | IBM/on-prem/LDAP/collector paths set timeouts |
| Background job queue | **P1→PARTIAL** | Reports/bundle `EXPORT_ROW_CAP` 5k + `load_only`; full async queue = later |
| OTel trace slow requests | **P1→DONE (lite)** | `SlowRequestMiddleware` + `Server-Timing`; full OTLP when dep added |
| Select only needed columns | **P1→PARTIAL** | `GET /admin/provenance` backends `load_only`; expand per endpoint |

## Security

| Item | Status | Notes |
| --- | --- | --- |
| Security headers | **DONE** | `SecurityHeadersMiddleware` |
| CORS restrict | **P1→DONE** | Prod `validate_startup_configuration()` requires explicit `CORS_ORIGINS` |
| Admin route lockdown | **DONE** | `ApiAuthMiddleware` + RBAC |
| Session cookies secure | **P1→N/A (Bearer SPA)** | Documented in `SECURITY.md`; cookies only if added later |
| CSRF | **P1→DONE (Bearer SPA)** | Prod `OriginGuardMiddleware` when `CORS_ORIGINS` set; session is Bearer not cookie |
| Password hashing | **DONE** | PBKDF2-SHA256 120k (`app/api/auth.py`) |
| Server-side form validation | **P1→DONE (slice)** | Admin credentials/catalog Field limits; `ReportImportBody` |
| XSS hardening | **P1→DONE (slice)** | No `dangerouslySetInnerHTML` in `frontend/src` |
| Parameterized queries | **DONE** | SQLAlchemy ORM/SQL params |
| Rate limiting | **DONE** | Auth endpoints + `WriteRateLimitMiddleware` on API writes |
| Password reset expiry | **P1→DONE** | TTL 900s + `tests/test_password_reset_ttl.py` |
| Upload type/size limits | **P1→DONE** | Env import caps + bundle 2MB + client `assertImportSize` |
| Disable debug in prod | **DONE** | `validate_startup_configuration()` warns on `DEBUG` |
| Dependency CVEs | **DONE** | `scripts/run-dependency-audit.sh` + `.github/workflows/qtelescope-release-gates.yml` |
| Env variable validation | **DONE** | `app/core/startup_validation.py` on lifespan |

## Ops / INFRA (out of repo)

CDN static files, load balancing, brotli at edge — **INFRA** track with platform team. Client vitals card on Admin → Logs (**DONE** in-app slice); full RUM SaaS = INFRA.

## Shipped this wave (2026-11-09)

- Operator console: React hooks order fix; staged API load (centre → rest); alert limit 200 on console
- Backend: `sync_incidents_from_alerts_if_stale` (45s throttle) + batched incident–alert links
- `IstClock`: cached `Intl` formatters, pause when tab hidden
- `frontend/src/hooks/useDebouncedValue.js`
- `frontend/src/components/ui/AnimatedNumber.jsx`
- GZip middleware, debounced searches, KPI animation, skeleton gaps on Topology / Temporal / Anomaly

## Next P1 slice

1. Full OTLP exporter when `opentelemetry-*` deps approved.
2. ~~Dashboard bento + Alerts EDT density~~ — **DONE** (2026-11-09); 1024px bento compact column rule added.
3. Incident **chart deep link + PNG attach** (collaboration Phase 1 — `docs/product/COLLABORATION_WHITEBOARD.md`).
4. WebP/AVIF static assets when art pipeline grows (INFRA-adjacent).
