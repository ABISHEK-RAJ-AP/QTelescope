# Defect register

Evidence: 2026-11-05. Pytest `tests/` ignore e2e: **167 passed, 4 failed** then 2 TeleScope failures fixed; Govern inventory skipped.

| ID | Severity | Component | Issue | Root cause | Fix | Verification | Status |
| -- | -------- | --------- | ----- | ---------- | --- | ------------ | ------ |
| QT-01 | P1 | `GET /operations/platform-health` | HTTP 500 when ORM tables missing (lab SQLite / TestClient without lifespan) | Query `backend_telemetry` uncaught | Catch OperationalError, rollback, return `database.reachable=false` | `tests/test_incidents_p3.py::test_platform_health_endpoint` PASS | Fixed |
| QT-02 | P1 | `GET /operations/centre` | Same 500 on empty schema | Uncaught ORM reads | Wrap fleet queries; empty fleet | Code review + health test | Fixed |
| QT-03 | P2 | `build_coherence_snapshot` | Crash if `backends` table missing | Test/lab no `create_all` | Test applies schema | `test_build_coherence_snapshot_shape` PASS | Fixed (test) |
| QT-04 | P3 | `test_prod_profile_logs_rbac_warning` | Stale: prod defaults `ENFORCE_RBAC=true` so no warning | Test assumed unset = off | Set `ENFORCE_RBAC=false` in test | PASS | Fixed (test) |
| QT-05 | P2 | Govern `test_govern_route_inventory` | Missing QRP inventory md; App.jsx snippets drifted | Separate product | Skipped this checkout | N/A | Open (QRP) |
| QT-06 | P1 | Lab `.env` | `ADMIN_PASSWORD=quantum2026`, default `SECRET_KEY` | Bootstrap for demo VM | Prod profile blocks default password; rotate secrets on go-live | `test_bootstrap_security` | Open until prod env configured |
| QT-07 | P1 | MFA at rest | `data/user_mfa.json` secrets not encrypted | File store | Fernet `secret_enc` + migration | `test_mfa_at_rest.py` | **Fixed** (2026-11-09) |
| QT-08 | P1 | Password reset mail | No SMTP; lab returns `dev_reset_token` off-prod | No mailer | `mail_delivery.py` + prod forgot path | `test_password_reset_mail.py` | **Fixed (code)** — configure SMTP on VM |
| QT-09 | P2 | Playwright Q-TeleScope journeys | E01–E24 scripted + smoke | `telescope-journeys*.spec.ts` | Lab gate green; `run-e2e-telescope.sh` | `E2E_TELESCOPE_EVIDENCE.md` | **Fixed (lab)** — VM re-run before go-live |
| QT-10 | P2 | Frontend unit tests | `frontend/package.json` has no `test` script | Vite app only | `npm test` / Vitest | 7 tests PASS | **Fixed** (Sprint 2) |
| QT-11 | P2 | Sessions | In-memory unless `PERSIST_API_SESSIONS` | Restart drops tokens | Env flag exists | `test_sessions` | Open for multi-worker |
| QT-12 | P3 | Cert Studio copy | TeleScope ops shell ≠ Studio marketing | By design | Do not clone | Visual review BLOCKED | Accepted |
