import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, UserPlus } from 'lucide-react';
import { api } from '@/services/api';
import {
  isFleetUserAdmin,
  isOrgPeopleAdmin,
  roleLabel,
  rolesSelectableForInvite,
} from '@/lib/permissions.js';
import { RoleMatrix } from '@/components/admin/RoleMatrix.jsx';
import { Button } from '@/components/ui/Button';
import { Field, fieldClass } from '@/components/AuthShell';
import { TableEmpty } from '@/components/observability/EmptyState.jsx';
import { ConfirmDialog } from '@/components/observability/ConfirmDialog.jsx';
import { CollapsibleSection } from '@/components/observability/CollapsibleSection.jsx';
import { InfoTooltip } from '@/components/observability/InfoTooltip.jsx';
import { ListPager } from '@/components/observability/ListPager.jsx';
import { useDebouncedValue } from '@/hooks/useDebouncedValue.js';
import { formatISTTime } from '@/utils/time';
import { COPY } from '@/copy/operator.js';
import '@/components/observability/confirmDialog.css';

const TEST_USER = /^(chg_|mail_|mfa_|e2e_)/i;
const USER_SORTS = [
  { key: 'username', label: 'Username' },
  { key: 'role', label: 'Role' },
  { key: 'mfa', label: 'MFA' },
  { key: 'org', label: 'Organisation' },
];
const ACCOUNT_STATUS_LABEL = {
  active: 'Active',
  pending_admin: 'Pending',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

const PEOPLE_HELP_FLEET = `${COPY.auth.accessIntroFleet} ${COPY.auth.accessPendingSubtitle}`;
const PEOPLE_HELP_ORG = `${COPY.auth.accessIntroOrg} ${COPY.auth.accessPendingSubtitle}`;
const INVITE_HELP = `${COPY.auth.accessInviteSubtitle} Organisation comes from your scope filter (fleet) or is fixed for organisation administrators.`;
const MATRIX_HELP = 'Effective access by built-in role. Assign roles in the directory. Custom roles are editable under Security.';

function sessionUser() {
  try {
    return JSON.parse(localStorage.getItem('quantum_user') || 'null');
  } catch {
    return null;
  }
}

function resolveOrgForInvite(me, orgFilter, inviteOrgPick) {
  if (isOrgPeopleAdmin(me)) return (me.org || '').trim();
  const scoped = (orgFilter || '').trim();
  if (scoped) return scoped;
  return (inviteOrgPick || '').trim();
}

function PeopleTabBar({ tab, onTab, pendingCount }) {
  const items = [
    { id: 'queue', label: 'Queue', badge: pendingCount || null },
    { id: 'directory', label: 'Directory' },
  ];
  return (
    <div className="admin-people-tabs" role="tablist" aria-label="People views">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          className={`admin-people-tabs__btn${tab === t.id ? ' admin-people-tabs__btn--on' : ''}`}
          onClick={() => onTab(t.id)}
        >
          {t.label}
          {t.badge ? <span className="admin-people-tabs__badge">{t.badge}</span> : null}
        </button>
      ))}
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
      <header className="admin-access-card__head">
        <div>
          <h4 className="admin-access-card__name">{user.full_name || user.username}</h4>
          <p className="admin-access-card__meta">{user.email || user.username}</p>
          {user.org ? <p className="admin-access-card__org" title={user.org}>{user.org}</p> : null}
        </div>
        <span className="badge badge-warning">Pending</span>
      </header>
      {user.created_at ? (
        <p className="admin-people-muted">Submitted {formatISTTime(user.created_at)}</p>
      ) : null}
      {canEdit ? (
        <div className="admin-access-card__actions">
          <label className="outline-field admin-access-card__role">
            <span>Role</span>
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
            <button type="button" className="btn btn-primary btn--sm" disabled={busy} onClick={() => onApprove(user.username)}>
              Approve
            </button>
            <button type="button" className="btn btn-ghost btn--sm" disabled={busy} onClick={() => onReject(user.username)}>
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
        <button type="button" className="btn btn-secondary btn--sm" disabled={busy} onClick={() => onReopen(user.username)}>
          Re-open
        </button>
      ) : null}
    </article>
  );
}

export function AccessApprovalsPanel({ canEdit, onNotice }) {
  const me = sessionUser();
  const fleetAdmin = isFleetUserAdmin(me);
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [orgFilter, setOrgFilter] = useState(isOrgPeopleAdmin(me) ? (me.org || '') : '');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [tab, setTab] = useState('queue');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteOrgPick, setInviteOrgPick] = useState('');
  const [invite, setInvite] = useState({
    username: '',
    email: '',
    full_name: '',
    role: 'Operator',
    password: '',
  });
  const [inviteFieldErr, setInviteFieldErr] = useState({});
  const [inviteErr, setInviteErr] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sortKey, setSortKey] = useState('username');
  const [showTestAccounts, setShowTestAccounts] = useState(false);
  const [dirPage, setDirPage] = useState(1);
  const DIR_PAGE = 20;

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
      onNotice?.({ type: 'error', text: e?.message || 'Could not load people data.' });
    } finally {
      setLoading(false);
    }
  }, [onNotice]);

  useEffect(() => { load(); }, [load]);

  const scopedRows = useMemo(() => {
    if (isOrgPeopleAdmin(me) && me.org) {
      const key = me.org.trim().toLowerCase();
      return rows.filter((u) => (u.org || '').toLowerCase() === key);
    }
    if (!fleetAdmin || !orgFilter.trim()) return rows;
    const key = orgFilter.trim().toLowerCase();
    return rows.filter((u) => (u.org || '').toLowerCase() === key);
  }, [rows, fleetAdmin, orgFilter, me]);

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

  const pending = useMemo(
    () => scopedRows.filter((u) => (u.account_status || 'active') === 'pending_admin'),
    [scopedRows],
  );
  const rejected = useMemo(
    () => scopedRows.filter((u) => (u.account_status || '') === 'rejected'),
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

  const directoryRows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    let list = showTestAccounts ? scopedRows : scopedRows.filter((u) => !TEST_USER.test(u.username || ''));
    if (q) {
      list = list.filter((u) => (
        `${u.username} ${u.full_name || ''} ${u.email || ''} ${u.role || ''} ${u.org || ''}`.toLowerCase().includes(q)
      ));
    }
    return [...list].sort((a, b) => {
      if (sortKey === 'mfa') {
        return Number(Boolean(b.mfa_enabled)) - Number(Boolean(a.mfa_enabled))
          || String(a.username).localeCompare(String(b.username));
      }
      if (sortKey === 'role') {
        return roleLabel(a.role).localeCompare(roleLabel(b.role)) || String(a.username).localeCompare(String(b.username));
      }
      if (sortKey === 'org') {
        return String(a.org || '').localeCompare(String(b.org || '')) || String(a.username).localeCompare(String(b.username));
      }
      return String(a.username).localeCompare(String(b.username));
    });
  }, [scopedRows, debouncedSearch, sortKey, showTestAccounts]);

  useEffect(() => { setDirPage(1); }, [debouncedSearch, sortKey, orgFilter]);
  const dirPages = Math.max(1, Math.ceil(directoryRows.length / DIR_PAGE));
  const dirPageSafe = Math.min(dirPage, dirPages);
  const pageUsers = directoryRows.slice((dirPageSafe - 1) * DIR_PAGE, dirPageSafe * DIR_PAGE);
  const hiddenTestUsers = scopedRows.filter((u) => TEST_USER.test(u.username || '')).length;

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
        ? `${username} is active.`
        : accountStatus === 'suspended'
          ? `${username} suspended.`
          : accountStatus === 'rejected'
            ? `${username} rejected.`
            : accountStatus === 'pending_admin'
              ? `${username} back in queue.`
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

  const requestStatusChange = (username, accountStatus, { title, body } = {}) => {
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
    const orgForInvite = resolveOrgForInvite(me, orgFilter, inviteOrgPick);
    if (!orgForInvite) next.org = true;
    setInviteFieldErr(next);
    return Object.keys(next).length === 0;
  };

  const submitInvite = async (e) => {
    e.preventDefault();
    setInviteErr('');
    if (!canEdit) return;
    if (!validateInvite()) {
      setInviteErr(fleetAdmin && !orgFilter.trim() && !inviteOrgPick
        ? 'Choose an organisation in the toolbar or in the invite form.'
        : 'Check highlighted fields.');
      return;
    }
    setBusy('invite');
    const orgForInvite = resolveOrgForInvite(me, orgFilter, inviteOrgPick);
    try {
      const res = await api.inviteUser({
        username: invite.username.trim(),
        email: invite.email.trim(),
        full_name: invite.full_name.trim(),
        org: orgForInvite,
        role: invite.role,
        password: invite.password,
      });
      onNotice?.({ type: 'success', text: res?.message || `${invite.username.trim()} invited.` });
      setInvite({
        username: '',
        email: '',
        full_name: '',
        role: invite.role,
        password: '',
      });
      setInviteFieldErr({});
      setInviteOpen(false);
      await load();
      setTab('directory');
    } catch (err) {
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
  };

  const scopeOrgLabel = isOrgPeopleAdmin(me)
    ? (me.org || 'Your organisation')
    : (orgFilter.trim() || 'All organisations');
  const canInviteMembers = canEdit && (isOrgPeopleAdmin(me) || (fleetAdmin && orgFilter.trim()));

  return (
    <div className="admin-access admin-people" data-tour="page-admin-access">
      <header className="card admin-people-toolbar reg-cert-panel">
        <div className="admin-people-toolbar__row">
          <PeopleTitleRow className="admin-people-toolbar__title">
            <h2 className="admin-card-title">People &amp; access</h2>
            <InfoTooltip label="People and access scope">
              {fleetAdmin ? PEOPLE_HELP_FLEET : PEOPLE_HELP_ORG}
              {policy?.require_admin_approval
                ? ' Admin approval is required before first sign-in.'
                : ' With approval off, verified self-registrations activate immediately.'}
            </InfoTooltip>
          </PeopleTitleRow>
          <div className="admin-people-toolbar__actions">
            {fleetAdmin ? (
              <label className="admin-people-scope outline-field">
                <span className="visually-hidden">Organisation scope</span>
                <select
                  className="input-control"
                  value={orgFilter}
                  onChange={(e) => setOrgFilter(e.target.value)}
                  aria-label="Organisation scope"
                >
                  <option value="">All organisations</option>
                  {orgChoices.map((org) => (
                    <option key={org} value={org}>{org}</option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="admin-people-scope-readout badge badge-info">{scopeOrgLabel}</span>
            )}
            <button
              type="button"
              className="btn btn-secondary btn--sm"
              disabled={loading}
              onClick={load}
              aria-label="Refresh"
            >
              <RefreshCw size={14} aria-hidden className={loading ? 'admin-access-spin' : undefined} />
            </button>
            {canInviteMembers ? (
              <button
                type="button"
                className="btn btn-primary btn--sm"
                onClick={() => {
                  setInviteErr('');
                  setInviteOpen(true);
                }}
              >
                <UserPlus size={14} aria-hidden />
                Invite member
              </button>
            ) : null}
          </div>
        </div>
        <PeopleTabBar tab={tab} onTab={setTab} pendingCount={pending.length} />
      </header>

      {tab === 'queue' && (
        <>
          <CollapsibleSection
            id="admin-pending-h"
            title="Pending approval"
            defaultOpen={pending.length > 0}
            className="card admin-people-panel"
            help={COPY.auth.accessPendingSubtitle}
            actions={<span className="badge badge-warning">{pending.length}</span>}
          >
            {loading && pending.length === 0 ? (
              <p className="admin-people-muted">Loading…</p>
            ) : pending.length === 0 ? (
              <TableEmpty
                as="block"
                title="Queue empty"
                message="Verified self-registrations appear here when admin approval is on."
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
                      body: `${name} cannot sign in until re-opened.`,
                    })}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {rejected.length > 0 ? (
            <CollapsibleSection
              id="admin-rejected-h"
              title="Rejected"
              defaultOpen={false}
              className="card admin-people-panel"
              help={COPY.auth.accessRejectedSubtitle}
              actions={<span className="badge badge-offline">{rejected.length}</span>}
            >
              <div className="admin-access-grid">
                {rejected.map((u) => (
                  <RejectedCard
                    key={u.username}
                    user={u}
                    canEdit={canEdit}
                    busy={busy === `status:${u.username}`}
                    onReopen={(name) => requestStatusChange(name, 'pending_admin', {
                      title: 'Re-open registration?',
                      body: `${name} returns to the pending queue.`,
                    })}
                  />
                ))}
              </div>
            </CollapsibleSection>
          ) : null}
        </>
      )}

      {tab === 'directory' && (
        <section className="card admin-people-panel" aria-labelledby="admin-dir-h">
          <PeopleTitleRow id="admin-dir-h" className="admin-people-panel__head">
            <h3 className="admin-card-title">Directory</h3>
            <InfoTooltip label="User directory">Search, sort, assign roles, and suspend or approve accounts in your current scope.</InfoTooltip>
          </PeopleTitleRow>
          <div className="admin-users-toolbar">
            <label className="admin-users-search outline-field">
              <span className="visually-hidden">Search</span>
              <input
                type="search"
                className="input-control"
                placeholder="Name, email, role, org…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label className="outline-field admin-people-sort">
              <span className="visually-hidden">Sort</span>
              <select className="input-control" value={sortKey} onChange={(e) => setSortKey(e.target.value)} aria-label="Sort">
                {USER_SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            {hiddenTestUsers > 0 ? (
              <label className="admin-people-check">
                <input type="checkbox" checked={showTestAccounts} onChange={(e) => setShowTestAccounts(e.target.checked)} />
                Test ({hiddenTestUsers})
              </label>
            ) : null}
            <span className="admin-users-count" role="status">{directoryRows.length} shown</span>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>MFA</th>
                  <th>Org</th>
                  <th>Status</th>
                  {canEdit ? <th aria-label="Actions" /> : null}
                </tr>
              </thead>
              <tbody>
                {directoryRows.length === 0 ? (
                  <TableEmpty colSpan={canEdit ? 6 : 5} title="No users" message="No accounts in this scope." />
                ) : pageUsers.map((u) => {
                  const st = u.account_status || 'active';
                  return (
                    <tr key={u.username}>
                      <td>
                        <div>{u.full_name || u.username}</div>
                        <div className="al-sub">{u.email || u.username}</div>
                      </td>
                      <td>
                        {canEdit && st !== 'pending_admin' && st !== 'rejected' ? (
                          <select
                            className="input-control admin-users-role-select"
                            value={u.role || 'Operator'}
                            disabled={busy === u.username}
                            aria-label={`Role for ${u.username}`}
                            onChange={(e) => onRole(u.username, e.target.value)}
                          >
                            {[
                              ...roleOptions,
                              ...(u.role && !roleOptions.some((r) => (r.id || r.role) === u.role)
                                ? [{ id: u.role, label: roleLabel(u.role) }]
                                : []),
                            ].map((r) => (
                              <option key={r.id || r.role} value={r.id || r.role}>{r.label || roleLabel(r.id || r.role) || r.id}</option>
                            ))}
                          </select>
                        ) : (roleLabel(u.role) || u.role || '—')}
                      </td>
                      <td>{u.mfa_enabled ? 'On' : 'Off'}</td>
                      <td>{u.org || '—'}</td>
                      <td>{ACCOUNT_STATUS_LABEL[st] || st}</td>
                      {canEdit ? (
                        <td>
                          {st === 'pending_admin' ? (
                            <div className="admin-users-status-actions">
                              <button type="button" className="btn btn--sm btn--primary" disabled={busy === `status:${u.username}`} onClick={() => requestStatusChange(u.username, 'active')}>Approve</button>
                              <button type="button" className="btn btn--sm btn--ghost" disabled={busy === `status:${u.username}`} onClick={() => requestStatusChange(u.username, 'rejected', { title: 'Reject?', body: `${u.username} cannot sign in.` })}>Reject</button>
                            </div>
                          ) : st === 'active' ? (
                            <button type="button" className="btn btn--sm btn--ghost" disabled={busy === `status:${u.username}`} onClick={() => requestStatusChange(u.username, 'suspended', { title: 'Suspend?', body: `${u.username} blocked at sign-in.` })}>Suspend</button>
                          ) : st === 'suspended' ? (
                            <button type="button" className="btn btn--sm btn--primary" disabled={busy === `status:${u.username}`} onClick={() => requestStatusChange(u.username, 'active')}>Reactivate</button>
                          ) : st === 'rejected' ? (
                            <button type="button" className="btn btn--sm btn--secondary" disabled={busy === `status:${u.username}`} onClick={() => requestStatusChange(u.username, 'pending_admin', { title: 'Re-open?', body: 'Returns to pending queue.' })}>Re-open</button>
                          ) : '—'}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {directoryRows.length > DIR_PAGE ? (
            <ListPager page={dirPageSafe} pages={dirPages} onPage={setDirPage} />
          ) : null}
        </section>
      )}

      {inviteOpen && canInviteMembers ? createPortal(
        <div
          className="confirm-dialog-backdrop"
          role="presentation"
          onClick={() => busy !== 'invite' && setInviteOpen(false)}
        >
          <div
            className="confirm-dialog invite-member-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-invite-modal-h"
            onClick={(e) => e.stopPropagation()}
          >
            <PeopleTitleRow className="admin-people-panel__head">
              <h3 id="admin-invite-modal-h" className="admin-card-title">Invite member</h3>
              <InfoTooltip label="Invite operator">{INVITE_HELP}</InfoTooltip>
            </PeopleTitleRow>
            {!isOrgPeopleAdmin(me) && fleetAdmin && !orgFilter.trim() ? (
              <p className="admin-people-muted admin-people-invite-scope-hint">Set organisation scope in the toolbar or pick below.</p>
            ) : (
              <p className="admin-people-muted admin-people-invite-scope-hint">
                Org: <strong>{resolveOrgForInvite(me, orgFilter, inviteOrgPick) || scopeOrgLabel}</strong>
              </p>
            )}
            <form className="admin-access-invite__form admin-access-invite__form--modal" onSubmit={submitInvite} noValidate>
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
              </div>
              {fleetAdmin && !isOrgPeopleAdmin(me) && !orgFilter.trim() ? (
                <Field label="Organisation" forId="inv-org-pick">
                  <select
                    id="inv-org-pick"
                    className={`${fieldClass}${inviteFieldErr.org ? ' auth-field--invalid qt-shake' : ''}`}
                    value={inviteOrgPick}
                    onChange={(e) => setInviteOrgPick(e.target.value)}
                    required
                  >
                    <option value="">Select organisation…</option>
                    {orgChoices.map((org) => (
                      <option key={org} value={org}>{org}</option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field label="Temporary password" forId="inv-pass">
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
              {inviteErr ? <p className="auth-field-error qt-shake" role="alert">{inviteErr}</p> : null}
              <div className="confirm-dialog__actions invite-member-modal__actions">
                <button type="button" className="btn btn-secondary" disabled={busy === 'invite'} onClick={() => setInviteOpen(false)}>
                  Cancel
                </button>
                <Button type="submit" className="auth-cta" disabled={busy === 'invite'}>
                  {busy === 'invite' ? 'Creating…' : 'Create account'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      ) : null}

      <CollapsibleSection
        id="admin-rbac-h"
        title="Role matrix"
        defaultOpen={false}
        className="card admin-people-panel"
        help={MATRIX_HELP}
      >
        <RoleMatrix canEditAccess={canEdit} compact />
      </CollapsibleSection>

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

function PeopleTitleRow({ className = '', id, children }) {
  return <div className={`admin-people-title-row ${className}`.trim()} {...(id ? { id } : {})}>{children}</div>;
}