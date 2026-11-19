import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, UserPlus } from 'lucide-react';
import { api } from '@/services/api';
import { roleLabel } from '@/lib/permissions.js';
import { Button } from '@/components/ui/Button';
import { Field, fieldClass } from '@/components/AuthShell';
import { TableEmpty } from '@/components/observability/EmptyState.jsx';
import { formatISTTime } from '@/utils/time';

const FLOW_STEPS = ['Register', 'Verify email', 'Approve'];

function FlowTrail({ currentIndex = 2 }) {
  return (
    <div className="admin-access-flow" role="list" aria-label="Registration review flow">
      {FLOW_STEPS.map((label, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        let cls = 'admin-access-flow__step';
        if (done) cls += ' admin-access-flow__step--done';
        else if (active) cls += ' admin-access-flow__step--current';
        return (
          <span key={label} className={cls} role="listitem">
            {done ? <Check className="admin-access-flow__check" strokeWidth={2.5} aria-hidden /> : (
              <span className="admin-access-flow__num" aria-hidden>{i + 1}</span>
            )}
            <span>{label}</span>
          </span>
        );
      })}
    </div>
  );
}

function PendingCard({ user, roleOptions, canEdit, busy, onRole, onApprove, onReject }) {
  const [draftRole, setDraftRole] = useState(user.role || 'Operator');
  useEffect(() => {
    setDraftRole(user.role || 'Operator');
  }, [user.role]);

  return (
    <article className="admin-access-card">
      <FlowTrail currentIndex={2} />
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

export function AccessApprovalsPanel({ canEdit, onNotice }) {
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [busy, setBusy] = useState('');
  const [invite, setInvite] = useState({
    username: '',
    email: '',
    full_name: '',
    org: '',
    role: 'Operator',
    password: '',
  });
  const [inviteErr, setInviteErr] = useState('');
  const [inviteOk, setInviteOk] = useState('');

  const load = useCallback(async () => {
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
    }
  }, [onNotice]);

  useEffect(() => { load(); }, [load]);

  const pending = useMemo(
    () => rows.filter((u) => (u.account_status || 'active') === 'pending_admin'),
    [rows],
  );

  const roleOptions = useMemo(() => {
    const legacyAlias = new Set(['Admin', 'Operator', 'Researcher']);
    const seen = new Set();
    return (roles || []).filter((r) => {
      const id = r.id || r.role;
      if (!id || seen.has(id) || legacyAlias.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [roles]);

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

  const onStatus = async (username, accountStatus) => {
    setBusy(`status:${username}`);
    const prev = rows;
    setRows((list) => list.map((u) => (u.username === username ? { ...u, account_status: accountStatus } : u)));
    try {
      await api.setUserAccountStatus(username, accountStatus);
      onNotice?.({
        type: 'success',
        text: accountStatus === 'active' ? `${username} approved — they can sign in.` : `${username} rejected.`,
      });
    } catch (e) {
      setRows(prev);
      onNotice?.({ type: 'error', text: e?.message || 'Status update failed.' });
    } finally {
      setBusy('');
    }
  };

  const submitInvite = async (e) => {
    e.preventDefault();
    setInviteErr('');
    setInviteOk('');
    if (!canEdit) return;
    if ((invite.password || '').length < 6) {
      setInviteErr('Temporary password must be at least 6 characters.');
      return;
    }
    setBusy('invite');
    try {
      const res = await api.inviteUser({
        username: invite.username.trim(),
        email: invite.email.trim(),
        full_name: invite.full_name.trim(),
        org: invite.org.trim(),
        role: invite.role,
        password: invite.password,
      });
      setInviteOk(res?.message || `${invite.username.trim()} invited.`);
      setInvite({ username: '', email: '', full_name: '', org: '', role: invite.role, password: '' });
      await load();
    } catch (err) {
      setInviteErr(err?.message || 'Invite failed.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="admin-access" data-tour="page-admin-access">
      <div className="card admin-access-intro">
        <h3 className="admin-card-title">Access &amp; approvals</h3>
        <p className="page-hint">
          Self-service signups land here after email verification.
          {policy?.require_admin_approval
            ? ' Approval is required before first sign-in.'
            : ' This deployment may activate accounts immediately — pending queue appears when admin approval is enabled.'}
          {' '}
          Use invite to add operators without the public registration flow.
        </p>
        <FlowTrail currentIndex={policy?.require_admin_approval ? 2 : 1} />
        <p className="page-hint admin-access-intro__foot">
          Full directory and role matrix: <Link className="fs-link" to="/app/admin/users">Users &amp; roles</Link>
        </p>
      </div>

      <section className="card admin-access-queue" aria-labelledby="admin-access-queue-h">
        <div className="admin-access-queue__head">
          <h3 id="admin-access-queue-h" className="admin-card-title">Pending approvals</h3>
          <span className="badge badge-info" role="status">{pending.length} waiting</span>
        </div>
        {pending.length === 0 ? (
          <TableEmpty
            colSpan={1}
            title="No pending requests"
            message="New self-registrations appear here when admin approval is on."
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
                onApprove={(name) => onStatus(name, 'active')}
                onReject={(name) => onStatus(name, 'rejected')}
              />
            ))}
          </div>
        )}
      </section>

      {canEdit ? (
        <section className="card admin-access-invite" aria-labelledby="admin-access-invite-h">
          <div className="admin-access-invite__head">
            <UserPlus size={20} aria-hidden />
            <h3 id="admin-access-invite-h" className="admin-card-title">Invite operator</h3>
          </div>
          <p className="page-hint">Creates an active account. Share the temporary password securely; they change it under Settings.</p>
          <form className="admin-access-invite__form" onSubmit={submitInvite} noValidate>
            <div className="admin-access-invite__row">
              <Field label="Username" forId="inv-username">
                <input
                  id="inv-username"
                  className={fieldClass}
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
                  className={fieldClass}
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
              <Field label="Organisation" forId="inv-org">
                <input
                  id="inv-org"
                  className={fieldClass}
                  value={invite.org}
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
              <Field label="Temporary password" forId="inv-pass" hint="Min 6 characters">
                <input
                  id="inv-pass"
                  type="password"
                  className={fieldClass}
                  value={invite.password}
                  onChange={(e) => setInvite((s) => ({ ...s, password: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
              </Field>
            </div>
            {inviteErr ? <p className="auth-field-error" role="alert">{inviteErr}</p> : null}
            {inviteOk ? <p className="auth-inline-alert auth-inline-alert--success" role="status">{inviteOk}</p> : null}
            <Button type="submit" className="auth-cta" disabled={busy === 'invite'}>
              {busy === 'invite' ? 'Creating…' : 'Send invitation'}
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}