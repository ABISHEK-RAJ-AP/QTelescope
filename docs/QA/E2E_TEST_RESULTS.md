# E2E test results

| Journey | Result | Evidence |
| --- | --- | --- |
| 1 Login → MFA → Dashboard | BLOCKED | API MFA PASS (`test_auth_mfa_password`); no browser |
| 2 Dashboard → Backend → Telemetry | BLOCKED | No live UI this cycle |
| 3 Backend → Historical → Timeline | BLOCKED | |
| 4 Execution → Job details | BLOCKED | |
| 5 Alerts ack/resolve | API RBAC 403 PASS (`test_incidents_p3`) | UI BLOCKED |
| 6 Reports generate/download | BLOCKED | |
| 7 Admin users/roles | BLOCKED | |
| 8 Admin config persist | BLOCKED | |
| 9 Forgot → reset → login | API PASS | UI pages exist (`ForgotPasswordPage`, `ResetPasswordPage`) |
| 10 Change password | API PASS | Settings UI exists |
| 11 Logout → protected routes | API session tests PASS | Browser back-nav BLOCKED |
| 12 Restricted user denial | `ENFORCE_RBAC` 403 PASS | UI hide Admin only |

Playwright: `tests/e2e/govern-smoke.spec.ts` is **Govern SPA**, skip unless `E2E_PLAYWRIGHT=1`. Not Q-TeleScope `frontend/`.
