# Council transcript — Q-TeleScope RBAC & account settings
**2026-11-20**

## Framed question

Q-TeleScope (quantum fleet monitoring console, Operate mode) just shipped:

- Bootstrap login `superadmin` → **PlatformAdmin** (fleet-wide).
- **SuperAdmin** role → **organisation-scoped** (same capability band as OrgAdmin: invite, assign operator roles, suspend within one org).
- Account **Settings → Security**: removed Role & access capability matrix; compact **Sign-in** (this device + count + “Sign out other devices”).
- **MAX_SESSIONS_PER_USER=2** with oldest-session eviction on new login.
- **Invite member** on People & access: org admins anytime; platform admins only when an organisation scope is selected in the toolbar.

**Stake:** Mis-labelled roles and session noise confused operators; platform vs org duties must match how C-DAC-style deployments run (platform operators vs lab org admins).

**Verify:** API tests, frontend vitest, impeccable detect on UserSettings + AccessApprovalsPanel.

---

## Advisor lenses (condensed)

**Contrarian:** Renaming `SuperAdmin` to org-scope while the username remains `superadmin` as PlatformAdmin is a footgun. Existing DB rows with `role: SuperAdmin` may lose fleet powers silently. Session cap of 2 may log out legitimate multi-device ops without warning.

**First principles:** Users need three truths only in Settings: who am I, how do I secure the account, is anyone else signed in. Capability matrices belong in admin docs, not self-service. Platform vs org split is correct primitive; label **Platform administrator** on bootstrap account clearly in UI.

**Expansionist:** Org-scoped SuperAdmin plus platform invite gated on org filter enables federated labs without platform admins minting random org members. Session cap reduces stale dev tokens — add optional org policy later.

**Outsider:** “SuperAdmin” sounds like god mode; showing “Platform administrator” on login is clearer. Removing twenty “Revoke” rows is obviously better. Invite hidden until org picked is confusing unless the toolbar says why.

**Executor:** Ship checklist: pull `ef0fe2d+`, run pytest subset, `npm run build`, sign in once to prune sessions, document `MAX_SESSIONS_PER_USER`. Fix alembic `migration_util` import so CI/VM tests boot. Add one line in People & access when platform admin has no org scope: “Select an organisation to invite.”

---

## Peer-review themes

- Strongest: **First principles** (settings surface simplified to task).
- Biggest blind spot: **Contrarian** on legacy `SuperAdmin` users and username/role naming.
- All missed: explicit **migration note** for admins with old SuperAdmin fleet accounts.

---

## Chairman verdict

### Where the council agrees
- Platform vs organisation RBAC matches stated intent.
- Removing capability matrix from Settings is correct for Operate mode.
- Compact sessions + cap beats long revoke lists for dev-heavy use.
- Profile `/me` using session role fixes bootstrap label drift.

### Where the council clashes
- **SuperAdmin** as org role name vs **superadmin** username as platform: workable but needs copy/tooltip once.
- Session cap **2** vs ops with laptop + phone: env-tunable; document default.

### Blind spots caught
- Alembic top-level `migration_util` imports broke TestClient startup — fixed (lazy import).
- Platform invite without org scope needs inline hint (nice-to-have).

### Recommendation
**Ship as-is** for VM update (`main` ≥ `ef0fe2d` plus alembic fix commit). Treat naming as follow-up docs only unless legacy fleet SuperAdmin accounts exist in production data.

### One thing to do first on VM
`git pull && cd frontend && npm run build && cd .. && python3 -m pytest tests/test_org_user_admin.py tests/test_profile_role_label.py -q`