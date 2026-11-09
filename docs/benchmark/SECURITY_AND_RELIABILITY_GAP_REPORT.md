# Security & reliability gap report

**Date:** 2026-11-09

## Security — implemented (lab-evidenced)

| Control | Status | Evidence |
| --- | --- | --- |
| Password hashing | PASS | auth flows |
| MFA TOTP | PASS | `user_mfa.py` + Fernet at rest |
| Session TTL / revoke | PASS | `sessions.py`, E20 logout E2E |
| RBAC | PASS (prod default) | `rbac.py`, `test_rbac.py` |
| API auth middleware | PASS (prod default) | `api_auth.py`, public `/healthz` |
| Security headers | PASS | `SecurityHeadersMiddleware`, pytest |
| Rate limits | PARTIAL | in-memory / Redis optional |
| Audit | PARTIAL | `audit_log`, not full admin matrix |
| LDAP | PARTIAL | bind only |
| SSO OIDC/SAML | UNIMPLEMENTED | — |
| Secrets in logs | Policy | enforce in new log explorer |

**Open P1:** QT-06 — rotate demo secrets on production hosts ([DEFECT_REGISTER](../QA/DEFECT_REGISTER.md)).

## Reliability — gap vs SRE patterns

| Pattern | Status | Target |
| --- | --- | --- |
| SLOs / SLIs | UNIMPLEMENTED | Collector success, API avail, telemetry freshness |
| Error budgets | UNIMPLEMENTED | Burn alerts |
| Synthetic checks | PARTIAL | Playwright + future probe worker |
| Multi-AZ / HA | NOT_VERIFIED | Deployment docs only |
| Backup restore | NOT_VERIFIED | S6 drill |
| Circuit breakers | UNIMPLEMENTED | Provider adapters |
| SSE replay | PARTIAL | Reconnect yes; Last-Event-ID no |
| Self-observability | PARTIAL | Platform health page |
| OTel metrics for app | FAIL (T13) | No Prometheus scrape shipped |

## Composite health (AWS pattern)

Proposed v1 rule (config, not code in this doc):

```
IF provider_disconnected AND collector_failed AND telemetry_age > threshold
THEN single incident "Provider connectivity" WITH correlated alert IDs
```

## Release alignment

- **Release A:** hardening (done S1–S3 baseline).  
- **Release B:** SLO module + synthetic scheduler.  
- **Release C:** on-call + notification routing + change audit.
