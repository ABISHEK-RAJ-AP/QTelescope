import { useEffect, useState } from 'react';
import { Filter } from 'lucide-react';
import { readContextProjectId, writeContextProjectId } from '@qre-theme/contextScope.js';
import { api } from '../api.js';
import { approvalsListPath } from '../lib/approvalsQuery.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import ListViewToolbar from '../components/ListViewToolbar.jsx';
import AdaptiveListView from '../components/AdaptiveListView.jsx';
import { ConfirmDialog, EmptyState } from '../components/ui.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';

const MEMBER_COLS = [
  { id: 'username', label: 'Username' },
  { id: 'role', label: 'Role' },
  { id: 'added', label: 'Added' },
  { id: 'actions', label: 'Actions' },
];

export default function ProjectDetail({ projectId, onBack, permissions = [], onOpen }) {
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ username: '', role: 'editor' });
  const [busy, setBusy] = useState(false);
  const [ctxProject, setCtxProject] = useState(() => readContextProjectId());
  const [openApprovals, setOpenApprovals] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);

  const canManage = permissions.includes('projects:update') || permissions.includes('platform:manage');
  const prefs = useTablePrefs('project-members', MEMBER_COLS);

  useEffect(() => {
    const sync = () => setCtxProject(readContextProjectId());
    window.addEventListener('qre-context-changed', sync);
    return () => window.removeEventListener('qre-context-changed', sync);
  }, []);

  function load() {
    setLoading(true);
    return Promise.all([
      api(`/projects/${encodeURIComponent(projectId)}`),
      api(`/projects/${encodeURIComponent(projectId)}/members`),
    ])
      .then(([proj, memberRows]) => {
        setProject(proj);
        setMembers(Array.isArray(memberRows) ? memberRows : memberRows?.items || []);
        setError('');
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [projectId]);

  useEffect(() => {
    api(approvalsListPath({ projectId }))
      .then((body) => setOpenApprovals(body.count ?? (body.items || []).length))
      .catch(() => setOpenApprovals(null));
  }, [projectId]);

  async function removeMember(username, memberRole) {
    if (memberRole === 'owner' || !canManage) return;
    setBusy(true);
    setNotice('');
    try {
      await api(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(username)}`, {
        method: 'DELETE',
      });
      setNotice(`Removed ${username}.`);
      setPendingRemove(null);
      await load();
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function addMember(event) {
    event.preventDefault();
    if (!form.username.trim()) return;
    setBusy(true);
    setNotice('');
    try {
      await api(`/projects/${encodeURIComponent(projectId)}/members`, {
        method: 'POST',
        body: JSON.stringify({ username: form.username.trim(), role: form.role }),
      });
      setForm({ username: '', role: 'editor' });
      setNotice('Member added.');
      await load();
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <GovernPageShell
      eyebrow="Governance"
      title={project?.name ?? 'Project'}
      subtitle={project ? `Owner ${project.owner_username} · ${project.project_id}` : undefined}
      loading={loading && !project}
      error={error}
      notice={notice}
      onRetry={load}
      onOpen={onOpen}
      loadingLabel="Loading project…"
      actions={
        project ? (
          <>
            <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onBack('#/projects')}>
              Back
            </button>
            <button
              type="button"
              className="qre-btn qre-btn--ghost"
              onClick={() => {
                const on = ctxProject === projectId;
                writeContextProjectId(on ? '' : projectId);
                setCtxProject(on ? '' : projectId);
              }}
            >
              <Filter size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {ctxProject === projectId ? 'Clear govern context' : 'Set govern context'}
            </button>
            <button
              type="button"
              className="qre-btn qre-btn--ghost"
              onClick={() => navigator.clipboard?.writeText(projectId)}
            >
              Copy project ID
            </button>
            {onOpen && openApprovals != null && openApprovals > 0 && (
              <button
                type="button"
                className="qre-btn qre-btn--primary"
                onClick={() => {
                  writeContextProjectId(projectId);
                  setCtxProject(projectId);
                  onOpen('#/queue');
                }}
              >
                Approvals ({openApprovals})
              </button>
            )}
          </>
        ) : null
      }
    >
      {project ? (
      <div className="govern-review-grid">
        <div className="qre-card">
          <h3 className="govern-section-title">Project summary</h3>
          <dl className="govern-dl">
            <div>
              <dt>Template</dt>
              <dd>{project.template_id || '—'}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{project.project_type}</dd>
            </div>
            <div>
              <dt>Archived</dt>
              <dd>{project.is_archived ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{project.updated_at ? new Date(project.updated_at).toLocaleString() : '—'}</dd>
            </div>
          </dl>
          {project.submission_lock?.locked && (
            <p
              className={`qre-alert${
                project.submission_lock.governance_state === 'approved'
                  ? ' govern-notice--ok'
                  : ' govern-notice--warn'
              }`}
              style={{ marginTop: 12 }}
            >
              {project.submission_lock.governance_state === 'approved'
                ? 'Build edits stay locked while an approved submission is on record. Request changes in Govern or withdraw to unlock editing.'
                : 'Governance lock active while a submission is in review — Build cannot change project or circuit until resolved.'}
              {project.submission_lock.reason && (
                <span className="govern-muted" style={{ display: 'block', marginTop: 6, fontSize: 'var(--text-xs)' }}>
                  {project.submission_lock.reason}
                </span>
              )}
            </p>
          )}
        </div>

        <div className="qre-card">
          <div className="govern-section-head">
            <h3 className="govern-section-title">Members</h3>
            <span className="govern-status">{members.length}</span>
            <ListViewToolbar prefs={prefs} columns={MEMBER_COLS} lockedIds={['username']} />
          </div>
          {members.length === 0 ? (
            <EmptyState title="No members listed" hint="The owner is recorded at project creation." />
          ) : (
            <AdaptiveListView
              prefs={prefs}
              items={members}
              columns={MEMBER_COLS}
              rowKey={(row) => `${row.username}-${row.role}`}
              table={
              <div className="govern-table-wrap">
              <table className="govern-table">
                <thead>
                  <tr>
                    {prefs.isVisible('username') && <th>Username</th>}
                    {prefs.isVisible('role') && <th>Role</th>}
                    {prefs.isVisible('added') && <th>Added</th>}
                    {canManage && prefs.isVisible('actions') && <th />}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={`${m.username}-${m.role}`}>
                      {prefs.isVisible('username') && (
                      <td>
                        <strong>{m.username}</strong>
                      </td>
                      )}
                      {prefs.isVisible('role') && <td>{m.role}</td>}
                      {prefs.isVisible('added') && (
                      <td className="govern-muted">
                        {m.created_at ? new Date(m.created_at).toLocaleString() : '—'}
                      </td>
                      )}
                      {canManage && prefs.isVisible('actions') && (
                        <td>
                          {m.role !== 'owner' && (
                            <button
                              type="button"
                              className="qre-btn qre-btn--ghost"
                              style={{ padding: '4px 10px', fontSize: 'var(--text-xs)' }}
                              disabled={busy}
                              onClick={() => setPendingRemove(m)}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            }
          />
          )}

          {canManage && (
            <form className="govern-stack" style={{ marginTop: 20 }} onSubmit={addMember}>
              <p className="govern-muted" style={{ margin: 0 }}>
                Add a collaborator (server enforces tenant project access).
              </p>
              <label className="qre-field">
                <span className="qre-field__label">Username</span>
                <input
                  className="qre-field__input"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </label>
              <label className="qre-field">
                <span className="qre-field__label">Role</span>
                <select
                  className="qre-field__input"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              <button type="submit" className="qre-btn qre-btn--primary" disabled={busy}>
                Add member
              </button>
            </form>
          )}
        </div>
      </div>
      ) : null}
      <ConfirmDialog
        title={pendingRemove ? `Remove ${pendingRemove.username}?` : ''}
        body={pendingRemove ? 'They lose project access immediately. The owner cannot be removed here.' : ''}
        confirmLabel="Remove member"
        danger
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => pendingRemove && removeMember(pendingRemove.username, pendingRemove.role)}
      />
    </GovernPageShell>
  );
}
