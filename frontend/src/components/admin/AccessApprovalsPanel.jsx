import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, UserPlus } from 'lucide-react';
import { api } from '@/services/api';
import {
  isFleetUserAdmin,
  roleLabel,
  rolesSelectableForInvite,
} from '@/lib/permissions.js';
import {
  AccessLifecycleTrail,
  INVITE_LIFECYCLE_STEPS,
  REGISTRATION_REVIEW_STEPS,
} from '@/components/auth/AccessLifecycleTrail.jsx';
import { Button } from '@/components/ui/Button';
import { Field, fieldClass } from '@/components/AuthShell';
import { TableEmpty } from '@/components/observability/EmptyState.jsx';
import { ConfirmDialog } from '@/components/observability/ConfirmDialog.jsx';
import { formatISTTime } from '@/utils/time';
import { COPY } from '@/copy/operator.js';

function sessionUser() {
  try {
    return JSON.parse(localStorage.getItem('quantum_user') || 'null');
  } catch {
    return null;
  }
}

function PendingCard({ user, roleOptions, canEdit, busy, onRole, onApprove, onReject }) {
  const [draftRole, setDraftRole] = useState(user.role || 'Operator');
  useEffect(() => {
    setDraftRole(user.role || 'Operator');
  }, [user.role]);

  return (
    <article className="admin-access-card">
      <AccessLifecycleTrail
        steps={REGISTRATION_REVIEW_STEPS}
        currentId="approve"
        ariaLabel="Applicant registration progress"
      />
      <header className="admin-access-card__head">
        <div>
          <h4 className="admin-access-card__name">{user.full_name || user.username}</h4>
          <p className="admin-access-card__meta">{user.email || user.username}</p>
          {user.org ? <p className="admin-access-card__org" title={user.org}>{user.org}</p> : null}
        </div>
        <span className="badge badge-warning">Pending</span>
      </header>
      {user.created_at ? (
        <p className="page-hint" style={{ margin: 0 }}>Submitted {formatISTTime(user.created_at)}</p>
      ) : null}
      {canEdit ? (
        <div className="admin-access-card__actions">
          <label className="outline-field admin-access-card__role">
            <span>Role after approval</span>
            <select
              className="input-control"
              value={draftRole}
              disabled={busy}
              onChange={(e) => {
                const next = e.target.value;
                setDraftRole(next);
                onRole(user.username, next);
              }}
            >
              {roleOptions.map((r) => (
                <option key={r.id || r.role} value={r.id || r.role}>
                  {r.label || roleLabel(r.id || r.role)}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-access-card__btns">
            <button
              type="button"
              className="btn btn-primary btn--sm"
              disabled={busy}
              onClick={() => onApprove(user.username)}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn btn-ghost btn--sm"
              disabled={busy}
              onClick={() => onReject(user.username)}
            >
              Reject
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function RejectedCard({ user, canEdit, busy, onReopen }) {
  return (
    <article className="admin-access-card admin-access-card--muted">
      <header className="admin-access-card__head">
        <div>
          <h4 className="admin-access-card__name">{user.full_name || user.username}</h4>
          <p className="admin-access-card__meta">{user.email || user.username}</p>
          {user.org ? <p className="admin-access-card__org">{user.org}</p> : null}
        </div>
        <span className="badge badge-offline">Rejected</span>
      </header>
      {canEdit ? (
        <button
          type="button"
          className="btn btn-secondary btn--sm"
          disabled={busy}
          onClick={() => onReopen(user.username)}
        >
          Re-open for review
        </button>
      ) : null}
    </article>
  );
}

export function AccessApprovalsPanel({ canEdit, onNotice }) {
  const me = useMemo(() => sessionUser(), []);
  const fleetAdmin = isFleetUserAdmin(me);
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [orgFilter, setOrgFilter] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [inviteStep, setInviteStep] = useState('details');
  const [invite, setInvite] = useState({
    username: '',
    email: '',
    full_name: '',
    org: me?.org || '',
    role: 'Operator',
    password: '',
  });
  const [inviteFieldErr, setInviteFieldErr] = useState({});
  const [inviteErr, setInviteErr] = useState('');
  const [inviteOk, setInviteOk] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [users, catalog, reg] = await Promise.all([
        api.listUsers(),
        api.getRolesCatalog().catch(() => ({ roles: [] })),
        api.getRegistrationOptions().catch(() => ({})),
      ]);
      setRows(users || []);
      setRoles(catalog?.roles || []);
      setPolicy(reg);
    } catch (e) {
      onNotice?.({ type: 'error', text: e?.message || 'Could not load access queue.' });
    } finally {
      setLoading(false);
    }
  }, [onNotice]);

  useEffect(() => { load(); }, [load]);

  const scopedRows = useMemo(() => {
    if (!fleetAdmin || !orgFilter.trim()) return rows;
    const key = orgFilter.trim().toLowerCase();
    return rows.filter((u) => (u.org || '').toLowerCase() === key);
  }, [rows, fleetAdmin, orgFilter]);

  const orgChoices = useMemo(() => {
    const seen = new Set();
    const out = [];
    rows.forEach((u) => {
      const org = (u.org || '').trim();
      if (!org) return;
      const key = org.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(org);
    });
    return out.sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const orgStats = useMemo(() => {
    const map = new Map();
    rows.forEach((u) => {
      const org = (u.org || '—').trim() || '—';
      const cur = map.get(org) || { org, pending: 0, suspended: 0, active: 0, rejected: 0 };
      const st = u.account_status || 'active';
      if (st === 'pending_admin') cur.pending += 1;
      else if (st === 'suspended') cur.suspended += 1;
      else if (st === 'rejected') cur.rejected += 1;
      else if (st === 'active') cur.active += 1;
      map.set(org, cur);
    });
    return [...map.values()].sort((a, b) => a.org.localeCompare(b.org));
  }, [rows]);

  const pending = useMemo(
    () => scopedRows.filter((u) => (u.account_status || 'active') === 'pending_admin'),
    [scopedRows],
  );

  const rejected = useMemo(
    () => scopedRows.filter((u) => (u.account_status || '') === 'rejected'),
    [scopedRows],
  );

  const managedMembers = useMemo(
    () => scopedRows.filter((u) => {
      const st = u.account_status || 'active';
      return st === 'active' || st === 'suspended';
    }),
    [scopedRows],
  );

  const roleOptions = useMemo(() => {
    const legacyAlias = new Set(['Admin', 'Operator', 'Researcher']);
    const seen = new Set();
    const catalog = (roles || []).filter((r) => {
      const id = r.id || r.role;
      if (!id || seen.has(id) || legacyAlias.has(id)) return false;
      seen.add(id);
      return true;
    });
    const allowed = rolesSelectableForInvite(me);
    if (!allowed) return catalog;
    return catalog.filter((r) => allowed.includes(r.id || r.role));
  }, [roles, me]);

  const reviewTrailStep = policy?.require_admin_approval ? 'approve' : 'verify';

  const onRole = async (username, role) => {
    setBusy(username);
    const prev = rows;
    setRows((list) => list.map((u) => (u.username === username ? { ...u, role } : u)));
    try {
      await api.assignUserRole(username, role);
    } catch (e) {
      setRows(prev);
      onNotice?.({ type: 'error', text: e?.message || 'Role update failed.' });
    } finally {
      setBusy('');
    }
  };

  const applyStatus = async (username, accountStatus) => {
    setBusy(`status:${username}`);
    const prev = rows;
    setRows((list) => list.map((u) => (u.username === username ? { ...u, account_status: accountStatus } : u)));
    try {
      await api.setUserAccountStatus(username, accountStatus);
      const msg = accountStatus === 'active'
        ? `${username} is active — they can sign in.`
        : accountStatus === 'suspended'
          ? `${username} suspended.`
          : accountStatus === 'rejected'
            ? `${username} rejected.`
            : accountStatus === 'pending_admin'
              ? `${username} returned to the approval queue.`
              : `${username} updated.`;
      onNotice?.({ type: 'success', text: msg });
    } catch (e) {
      setRows(prev);
      onNotice?.({ type: 'error', text: e?.message || 'Status update failed.' });
    } finally {
      setBusy('');
      setConfirm(null);
    }
  };

  const requestStatusChange = (username, accountStatus, { title, body }) => {
    if (!canEdit) return;
    if (accountStatus === 'active' && !title) {
      applyStatus(username, accountStatus);
      return;
    }
    setConfirm({ username, accountStatus, title, body });
  };

  const validateInvite = () => {
    const next = {};
    if (!invite.username.trim() || invite.username.trim().length < 3) next.username = true;
    if (!invite.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email.trim())) next.email = true;
    if ((invite.password || '').length < 6) next.password = true;
    const orgForInvite = me?.role === 'OrgAdmin' ? (me.org || invite.org).trim() : invite.org.trim();
    if (!orgForInvite && me?.role !== 'OrgAdmin') next.org = true;
    setInviteFieldErr(next);
    return Object.keys(next).length === 0;
  };

  const submitInvite = async (e) => {
    e.preventDefault();
    setInviteErr('');
    setInviteOk('');
    if (!canEdit) return;
    if (!validateInvite()) {
      setInviteErr('Check the highlighted fields.');
      return;
    }
    setInviteStep('credentials');
    setBusy('invite');
    const orgForInvite = me?.role === 'OrgAdmin' ? (me.org || invite.org).trim() : invite.org.trim();
    try {
      const res = await api.inviteUser({
        username: invite.username.trim(),
        email: invite.email.trim(),
        full_name: invite.full_name.trim(),
        org: orgForInvite,
        role: invite.role,
        password: invite.password,
      });
      setInviteStep('active');
      setInviteOk(res?.message || `${invite.username.trim()} invited — active account ready.`);
      const keepOrg = me?.role === 'OrgAdmin' ? (me.org || '') : '';
      setInvite({
        username: '',
        email: '',
        full_name: '',
        org: keepOrg,
        role: invite.role,
        password: '',
      });
      setInviteFieldErr({});
      await load();
      setTimeout(() => setInviteStep('details'), 4000);
    } catch (err) {
      setInviteStep('details');
      setInviteErr(err?.message || 'Invite failed.');
    } finally {
      setBusy('');
    }
  };

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < 12; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
    setInvite((s) => ({ ...s, password: out }));
    setInviteStep('credentials');
  };

  return (
    <div className="admin-access" data-tour="page-admin-access">
      <div className="card admin-access-intro reg-cert-panel admin-access-intro--cert">
        <div className="admin-access-queue__head">
          <header className="reg-cert-head" style={{ textAlign: 'left', flex: 1 }}>
            <h3 className="admin-card-title" style={{ margin: 0 }}>Access &amp; approvals</h3>
            <p className="page-hint" style={{ marginTop: '0.35rem' }}>
              {fleetAdmin ? COPY.auth.accessIntroFleet : COPY.auth.accessIntroOrg}
              {' '}
              {policy?.require_admin_approval
                ? 'Approval is required before first sign-in.'
                : 'When approval is off, self-registrations activate immediately after email verification.'}
            </p>
          </header>
          <button
            type="button"
            className="btn btn-secondary btn--sm"
            disabled={loading}
            onClick={load}
            aria-label="Refresh access queue"
          >
            <RefreshCw size={14} aria-hidden className={loading ? 'admin-access-spin' : ''} />
            Refresh
          </button>
        </div>
        {fleetAdmin && orgStats.length > 0 ? (
          <div className="admin-access-org-stats" role="region" aria-label="Registrations by organisation">
            {orgStats.slice(0, 12).map((s) => (
              <button
                key={s.org}
                type="button"
                className={`admin-access-org-chip${orgFilter && orgFilter.toLowerCase() === s.org.toLowerCase() ? ' admin-access-org-chip--on' : ''}`}
                onClick={() => setOrgFilter((prev) => (prev.toLowerCase() === s.org.toLowerCase() ? '' : s.org))}
              >
                <span className="admin-access-org-chip__name">{s.org}</span>
                <span className="admin-access-org-chip__counts">
                  {[s.pending ? `${s.pending} pending` : null, s.suspended ? `${s.suspended} suspended` : null, s.rejected ? `${s.rejected} rejected` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {fleetAdmin ? (
          <label className="outline-field admin-access-org-filter">
            <span>Filter by organisation</span>
            <select
              className="input-control"
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
            >
              <option value="">All organisations</option>
              {orgChoices.map((org) => (
                <option key={org} value={org}>{org}</option>
              ))}
            </select>
          </label>
        ) : null}
        <AccessLifecycleTrail
          steps={REGISTRATION_REVIEW_STEPS}
          currentId={reviewTrailStep}
          ariaLabel="Registration and approval lifecycle"
        />
        <p className="page-hint admin-access-intro__foot">
          {COPY.auth.accessPendingSubtitle}{' '}
          <Link className="fs-link" to="/register">Public registration</Link>
          {' · '}
          <Link className="fs-link" to="/app/admin/users">Users &amp; roles</Link>
        </p>
      </div>

      <section className="card admin-access-queue" aria-labelledby="admin-access-queue-h">
        <div className="admin-access-queue__head">
          <h3 id="admin-access-queue-h" className="admin-card-title">Pending approvals</h3>
          <span className="badge badge-info" role="status">{pending.length} waiting</span>
        </div>
        {loading && pending.length === 0 ? (
          <p className="page-hint">Loading queue…</p>
        ) : pending.length === 0 ? (
          <TableEmpty
            colSpan={1}
            title="No pending requests"
            message="New self-registrations appear here after email verification when admin approval is enabled."
          />
        ) : (
          <div className="admin-access-grid">
            {pending.map((u) => (
              <PendingCard
                key={u.username}
                user={u}
                roleOptions={roleOptions.length ? roleOptions : [{ id: 'Operator', label: 'Operator' }]}
                canEdit={canEdit}
                busy={busy === u.username || busy === `status:${u.username}`}
                onRole={onRole}
                onApprove={(name) => requestStatusChange(name, 'active')}
                onReject={(name) => requestStatusChange(name, 'rejected', {
                  title: 'Reject registration?',
                  body: `${name} will not be able to sign in. You can re-open the request later from Rejected.`,
                })}
              />
            ))}
          </div>
        )}
      </section>

      {rejected.length > 0 ? (
        <section className="card admin-access-rejected" aria-labelledby="admin-access-rejected-h">
          <div className="admin-access-queue__head">
            <h3 id="admin-access-rejected-h" className="admin-card-title">Rejected requests</h3>
            <span className="badge badge-offline" role="status">{rejected.length}</span>
          </div>
          <p className="page-hint">{COPY.auth.accessRejectedSubtitle}</p>
          <div className="admin-access-grid">
            {rejected.map((u) => (
              <RejectedCard
                key={u.username}
                user={u}
                canEdit={canEdit}
                busy={busy === `status:${u.username}`}
                onReopen={(name) => requestStatusChange(name, 'pending_admin', {
                  title: 'Re-open registration?',
                  body: `${name} will return to the pending queue for approval.`,
                })}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="card admin-access-members" aria-labelledby="admin-access-members-h">
        <div className="admin-access-queue__head">
          <h3 id="admin-access-members-h" className="admin-card-title">Organisation members</h3>
          <span className="badge badge-info" role="status">{managedMembers.length} accounts</span>
        </div>
        {managedMembers.length === 0 ? (
          <TableEmpty
            colSpan={1}
            title="No members in scope"
            message={fleetAdmin && orgFilter ? 'No active or suspended users for this organisation.' : 'Approved and invited users appear here.'}
          />
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Organisation</th>
                  <th>Role</th>
                  <th>Status</th>
                  {canEdit ? <th aria-label="Account actions" /> : null}
                </tr>
              </thead>
              <tbody>
                {managedMembers.map((u) => {
                  const st = u.account_status || 'active';
                  return (
                    <tr key={u.username}>
                      <td>
                        <div>{u.full_name || u.username}</div>
                        <div className="al-sub">{u.email || u.username}</div>
                      </td>
                      <td>{u.org || '—'}</td>
                      <td>{roleLabel(u.role) || u.role}</td>
                      <td>{st === 'suspended' ? 'Suspended' : 'Active'}</td>
                      {canEdit ? (
                        <td>
                          {st === 'active' ? (
                            <button
                              type="button"
                              className="btn btn--sm btn--ghost"
                              disabled={busy === `status:${u.username}`}
                              onClick={() => requestStatusChange(u.username, 'suspended', {
                                title: 'Suspend account?',
                                body: `${u.username} will be blocked at sign-in until reactivated.`,
                              })}
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn--sm btn--primary"
                              disabled={busy === `status:${u.username}`}
                              onClick={() => requestStatusChange(u.username, 'active')}
                            >
                              Reactivate
                            </button>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canEdit ? (
        <section className="card admin-access-invite reg-cert-panel admin-access-invite--cert" aria-labelledby="admin-access-invite-h">
          <div className="admin-access-invite__head">
            <UserPlus size={20} aria-hidden />
            <header className="reg-cert-head" style={{ textAlign: 'left' }}>
              <h3 id="admin-access-invite-h" className="admin-card-title" style={{ margin: 0 }}>Invite operator</h3>
              <p className="page-hint" style={{ margin: '0.35rem 0 0' }}>{COPY.auth.accessInviteSubtitle}</p>
            </header>
          </div>
          <AccessLifecycleTrail
            steps={INVITE_LIFECYCLE_STEPS}
            currentId={inviteStep}
            ariaLabel="Invitation progress"
          />
          <form className="admin-access-invite__form" onSubmit={submitInvite} noValidate>
            <div className="admin-access-invite__row">
              <Field label="Username" forId="inv-username">
                <input
                  id="inv-username"
                  className={`${fieldClass}${inviteFieldErr.username ? ' auth-field--invalid qt-shake' : ''}`}
                  value={invite.username}
                  onChange={(e) => setInvite((s) => ({ ...s, username: e.target.value }))}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label="Email" forId="inv-email">
                <input
                  id="inv-email"
                  type="email"
                  className={`${fieldClass}${inviteFieldErr.email ? ' auth-field--invalid qt-shake' : ''}`}
                  value={invite.email}
                  onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))}
                  required
                />
              </Field>
            </div>
            <div className="admin-access-invite__row">
              <Field label="Full name" forId="inv-name">
                <input
                  id="inv-name"
                  className={fieldClass}
                  value={invite.full_name}
                  onChange={(e) => setInvite((s) => ({ ...s, full_name: e.target.value }))}
                />
              </Field>
              <Field label="Organisation" forId="inv-org" hint={me?.role === 'OrgAdmin' ? 'Locked to your organisation' : undefined}>
                <input
                  id="inv-org"
                  className={`${fieldClass}${inviteFieldErr.org ? ' auth-field--invalid qt-shake' : ''}`}
                  value={me?.role === 'OrgAdmin' ? (me.org || invite.org) : invite.org}
                  readOnly={me?.role === 'OrgAdmin'}
                  onChange={(e) => setInvite((s) => ({ ...s, org: e.target.value }))}
                />
              </Field>
            </div>
            <div className="admin-access-invite__row">
              <Field label="Role" forId="inv-role">
                <select
                  id="inv-role"
                  className={fieldClass}
                  value={invite.role}
                  onChange={(e) => setInvite((s) => ({ ...s, role: e.target.value }))}
                >
                  {(roleOptions.length ? roleOptions : [{ id: 'Operator' }, { id: 'Researcher' }]).map((r) => (
                    <option key={r.id || r.role} value={r.id || r.role}>
                      {r.label || roleLabel(r.id || r.role)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Temporary password" forId="inv-pass" hint="Min 6 characters — or generate">
                <div className="admin-access-invite__pass-row">
                  <input
                    id="inv-pass"
                    type="password"
                    className={`${fieldClass}${inviteFieldErr.password ? ' auth-field--invalid qt-shake' : ''}`}
                    value={invite.password}
                    onChange={(e) => setInvite((s) => ({ ...s, password: e.target.value }))}
                    autoComplete="new-password"
                    required
                  />
                  <button type="button" className="btn btn-secondary btn--sm" onClick={generateTempPassword}>
                    Generate
                  </button>
                </div>
              </Field>
            </div>
            {inviteErr ? <p className="auth-field-error qt-shake" role="alert">{inviteErr}</p> : null}
            {inviteOk ? <p className="auth-inline-alert auth-inline-alert--success" role="status">{inviteOk}</p> : null}
            <Button type="submit" className="auth-cta" disabled={busy === 'invite'}>
              {busy === 'invite' ? 'Creating…' : 'Send invitation'}
            </Button>
          </form>
        </section>
      ) : null}

      <ConfirmDialog
        dlg={confirm ? {
          title: confirm.title,
          body: confirm.body,
          confirm: 'Confirm',
          danger: confirm.accountStatus === 'rejected' || confirm.accountStatus === 'suspended',
          onConfirm: () => applyStatus(confirm.username, confirm.accountStatus),
        } : null}
        busy={Boolean(confirm && busy === `status:${confirm.username}`)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}