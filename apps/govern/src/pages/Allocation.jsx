import { useEffect, useState } from 'react';
import { api } from '../api.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import ListViewToolbar from '../components/ListViewToolbar.jsx';
import AdaptiveListView from '../components/AdaptiveListView.jsx';
import { ConfirmDialog, EmptyState, KpiStrip, WorkloadLink } from '../components/ui.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';
import { matchQuery } from '../lib/format.js';

const ATTEMPT_COLS = [
  { id: 'state', label: 'State' },
  { id: 'workload', label: 'Workload' },
  { id: 'class', label: 'Class' },
  { id: 'backend', label: 'Backend' },
  { id: 'job', label: 'External job' },
  { id: 'recorded', label: 'Recorded' },
  { id: 'reconcile', label: 'Reconcile' },
];

const REASON_LABEL = {
  approval_not_approved: 'Workload is not approved',
  backend_required: 'Hardware handoff needs a backend',
  backend_missing: 'Backend is not in the catalogue',
  provider_suspended: 'Provider is suspended',
  operation_not_declared: 'Provider has not declared submit',
  quota_fail: 'Daily shot quota would be exceeded',
};

export default function Allocation({ onOpen, permissions = [] }) {
  const [attempts, setAttempts] = useState([]);
  const [approved, setApproved] = useState([]);
  const [backends, setBackends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [check, setCheck] = useState({ workload_id: '', execution_class: 'simulated', backend_id: '' });
  const [checkResult, setCheckResult] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [icd, setIcd] = useState(null);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState(null);
  const [jobId, setJobId] = useState('');
  const [reason, setReason] = useState('');

  const canDispatch = permissions.includes('executions:submit') || permissions.includes('platform:manage');
  const canAuthorize = permissions.includes('approvals:decide') || permissions.includes('platform:manage');
  const canReconcile = permissions.includes('dispatch:reconcile') || permissions.includes('platform:manage');
  const prefs = useTablePrefs('allocation-attempts', ATTEMPT_COLS);

  function reload() {
    setLoading(true);
    return Promise.all([
      api('/dispatch-attempts').catch(() => ({ items: [] })),
      api('/approvals').catch(() => ({ items: [] })),
      api('/backends').catch(() => []),
      api('/dispatch-icd').catch(() => null),
    ])
      .then(([att, app, be, icdBody]) => {
        setAttempts(att.items || []);
        setApproved((app.items || []).filter((x) => x.governance_state === 'approved'));
        setBackends(Array.isArray(be) ? be : be.items || []);
        setIcd(icdBody);
        setError('');
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  async function runAuthorizeCheck(event) {
    event.preventDefault();
    if (!check.workload_id.trim()) return;
    setBusy(true);
    setCheckResult(null);
    setNotice('');
    try {
      const body = {
        execution_class: check.execution_class,
        backend_id: check.execution_class === 'hardware' ? check.backend_id || null : null,
      };
      const result = await api(`/workloads/${encodeURIComponent(check.workload_id.trim())}/authorize-dispatch`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setCheckResult(result);
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function recordDispatch(event) {
    event.preventDefault();
    if (!check.workload_id.trim()) return;
    setBusy(true);
    setNotice('');
    try {
      const key = `gov-ui-${check.workload_id.trim().slice(0, 8)}-${Date.now()}`;
      const result = await api(`/workloads/${encodeURIComponent(check.workload_id.trim())}/dispatch-attempts`, {
        method: 'POST',
        body: JSON.stringify({
          idempotency_key: key,
          execution_class: check.execution_class,
          backend_id: check.execution_class === 'hardware' ? check.backend_id || null : null,
        }),
      });
      setNotice(`Dispatch attempt recorded: ${result.dispatch_state}${result.replay ? ' (idempotent replay)' : ''}.`);
      await reload();
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmReconcile() {
    if (!pending) return;
    if (pending.outcome === 'confirmed' && !jobId.trim()) return;
    setBusy(true);
    setNotice('');
    try {
      const result = await api(`/dispatch-attempts/${encodeURIComponent(pending.attempt.attempt_id)}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({
          outcome: pending.outcome,
          external_job_id: jobId.trim() || null,
          reason: reason.trim() || null,
          connector_icd_version: icd?.icd_version || 'manual-v1',
        }),
      });
      setNotice(`Reconciled: ${result.dispatch_state}${result.external_job_id ? ` · job ${result.external_job_id}` : ''}.`);
      setPending(null);
      setJobId('');
      setReason('');
      await reload();
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  const visibleApproved = approved.filter((item) => matchQuery(query, item.workload_id, item.created_by));

  return (
    <GovernPageShell
      eyebrow="Resource management"
      title="Allocation & orchestration"
      subtitle="Governance authorization and dispatch attempts are separate from Q-Forge execution. No provider job is started here unless a connector is configured."
      loading={loading && attempts.length === 0 && approved.length === 0}
      error={error}
      notice={notice}
      onRetry={reload}
      onOpen={onOpen}
      loadingLabel="Loading allocation data…"
    >
      {attempts.length || approved.length ? (
        <KpiStrip
          items={[
            { key: 'approved', label: 'Approved', value: approved.length, hint: 'Ready to check' },
            { key: 'attempts', label: 'Attempts', value: attempts.length },
            {
              key: 'open',
              label: 'Open handoff',
              value: attempts.filter((a) => a.dispatch_state === 'dispatch_authorized' || a.dispatch_state === 'dispatch_unresolved').length,
            },
            { key: 'backends', label: 'Backends', value: backends.length },
          ]}
        />
      ) : null}
      <div className="qre-wizard-steps" role="list" aria-label="Dispatch workflow">
        <span className={`qre-wizard-step${checkResult ? ' qre-wizard-step--done' : ' qre-wizard-step--current'}`} role="listitem">
          1 · Eligibility
        </span>
        <span className={`qre-wizard-step${attempts.length ? ' qre-wizard-step--done' : checkResult ? ' qre-wizard-step--current' : ''}`} role="listitem">
          2 · Record attempt
        </span>
        <span className={`qre-wizard-step${attempts.some((a) => a.dispatch_state === 'dispatch_authorized' || a.dispatch_state === 'dispatch_unresolved') ? ' qre-wizard-step--current' : ''}`} role="listitem">
          3 · Reconcile
        </span>
      </div>
      {icd && (
        <div className="qre-card dashboard-card govern-stack">
          <h3 className="dashboard-card-title">Dispatch ICD ({icd.icd_version})</h3>
          <p className="govern-muted" style={{ margin: 0 }}>
            {icd.notes} Live connector: {icd.live_connector ? 'yes' : 'no — manual reconcile only'}.
          </p>
        </div>
      )}

      <div className="govern-review-grid">
        <form className="qre-card govern-stack" onSubmit={runAuthorizeCheck}>
          <h3 className="govern-section-title">Dispatch eligibility</h3>
          <p className="govern-muted" style={{ margin: 0 }}>
            Evaluate whether an approved workload may hand off to execution (approval + provider manifest rules).
          </p>
          <div className="govern-form-grid">
            <label className="qre-field">
              <span className="qre-field__label">Workload ID</span>
              <input
                className="qre-field__input govern-mono"
                value={check.workload_id}
                onChange={(e) => setCheck({ ...check, workload_id: e.target.value })}
                placeholder="Paste or pick from approved list"
                required
              />
            </label>
            <label className="qre-field">
              <span className="qre-field__label">Execution class</span>
              <select
                className="qre-field__input"
                value={check.execution_class}
                onChange={(e) => setCheck({ ...check, execution_class: e.target.value })}
              >
                <option value="simulated">Simulated</option>
                <option value="hardware">Hardware</option>
              </select>
            </label>
          </div>
          {check.execution_class === 'hardware' && (
            <label className="qre-field">
              <span className="qre-field__label">Backend</span>
              {backends.length ? (
                <select
                  className="qre-field__input"
                  value={check.backend_id}
                  onChange={(e) => setCheck({ ...check, backend_id: e.target.value })}
                >
                  <option value="">Select backend…</option>
                  {backends.map((b) => (
                    <option key={b.backend_id || b.id} value={b.backend_id || b.id}>
                      {b.backend_name || b.name || b.backend_id}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="qre-field__input govern-mono"
                  value={check.backend_id}
                  onChange={(e) => setCheck({ ...check, backend_id: e.target.value })}
                  placeholder="backend_id from catalogue"
                />
              )}
            </label>
          )}
          {checkResult && (
            <div className={`govern-elig${checkResult.eligible ? ' govern-elig--ok' : ' govern-elig--bad'}`}>
              <strong>{checkResult.eligible ? 'Eligible for handoff' : 'Not eligible'}</strong>
              <p className="govern-muted" style={{ margin: '6px 0 0' }}>
                Governance · {checkResult.governance_state || '—'}
                {checkResult.quota
                  ? ` · shots ${checkResult.quota.requested_shots ?? '—'} of ${checkResult.quota.remaining_shots ?? '—'} remaining (${checkResult.quota.window || 'today'})`
                  : ''}
              </p>
              {(checkResult.reasons || []).length ? (
                <ul>
                  {checkResult.reasons.map((code) => (
                    <li key={code}>{REASON_LABEL[code] || code}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {canAuthorize && (
              <button type="submit" className="qre-btn qre-btn--primary" disabled={busy}>
                Check eligibility
              </button>
            )}
            {canDispatch && (
              <button type="button" className="qre-btn qre-btn--ghost" disabled={busy} onClick={recordDispatch}>
                Record dispatch attempt
              </button>
            )}
          </div>
        </form>

        <div className="qre-card">
          <div className="govern-section-head">
            <h3 className="govern-section-title">Approved workloads</h3>
            <span className="govern-status govern-status--ok">{approved.length}</span>
          </div>
          {approved.length > 0 ? (
            <div className="page-filters">
              <input
                className="govern-search"
                type="search"
                placeholder="Workload or requester…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Find approved"
              />
            </div>
          ) : null}
          {approved.length === 0 ? (
            <EmptyState
              title="None approved yet"
              hint="Complete the approval queue before dispatch handoff."
              action={
                <button type="button" className="qre-btn qre-btn--primary" onClick={() => onOpen?.('#/queue')}>
                  Open queue
                </button>
              }
            />
          ) : (
            <ul className="qre-activity-list">
              {visibleApproved.slice(0, 12).map((item) => (
                <li key={item.submission_id}>
                  <WorkloadLink workloadId={item.workload_id} onOpen={onOpen} />
                  <button
                    type="button"
                    className="qre-btn qre-btn--ghost"
                    style={{ marginLeft: 8, padding: '2px 8px', fontSize: 'var(--text-xs)' }}
                    onClick={() => setCheck({ ...check, workload_id: item.workload_id })}
                  >
                    Use ID
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="qre-card">
        <div className="govern-section-head">
          <h3 className="govern-section-title">Dispatch attempt history</h3>
          <span className="govern-status">{attempts.length}</span>
          <ListViewToolbar prefs={prefs} columns={ATTEMPT_COLS} lockedIds={['state', 'workload']} />
        </div>
        {attempts.length === 0 ? (
          <EmptyState title="No dispatch attempts" hint="Attempts appear after authorized handoff is recorded." />
        ) : (
          <AdaptiveListView
            prefs={prefs}
            items={attempts}
            columns={ATTEMPT_COLS}
            rowKey={(row) => row.attempt_id}
            table={
            <div className="govern-table-wrap">
            <table className="govern-table">
              <thead>
                <tr>
                  {prefs.isVisible('state') && <th>State</th>}
                  {prefs.isVisible('workload') && <th>Workload</th>}
                  {prefs.isVisible('class') && <th>Class</th>}
                  {prefs.isVisible('backend') && <th>Backend</th>}
                  {prefs.isVisible('job') && <th>External job</th>}
                  {prefs.isVisible('recorded') && <th>Recorded</th>}
                  {canReconcile && prefs.isVisible('reconcile') && <th>Reconcile</th>}
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.attempt_id}>
                    {prefs.isVisible('state') && (
                    <td>
                      <span className="govern-status govern-status--ok">{a.dispatch_state}</span>
                    </td>
                    )}
                    {prefs.isVisible('workload') && (
                    <td>
                      <WorkloadLink workloadId={a.workload_id} onOpen={onOpen} />
                    </td>
                    )}
                    {prefs.isVisible('class') && <td>{a.execution_class}</td>}
                    {prefs.isVisible('backend') && <td className="govern-muted">{a.backend_id || '—'}</td>}
                    {prefs.isVisible('job') && <td className="govern-mono govern-muted">{a.external_job_id || '—'}</td>}
                    {prefs.isVisible('recorded') && <td className="govern-muted">{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>}
                    {canReconcile && prefs.isVisible('reconcile') && (
                      <td>
                        {(a.dispatch_state === 'dispatch_authorized' || a.dispatch_state === 'dispatch_unresolved') && (
                          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            <button
                              type="button"
                              className="qre-btn qre-btn--ghost"
                              style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }}
                              disabled={busy}
                              onClick={() => {
                                setPending({ attempt: a, outcome: 'confirmed' });
                                setJobId('');
                                setReason('');
                              }}
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              className="qre-btn qre-btn--ghost"
                              style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }}
                              disabled={busy}
                              onClick={() => {
                                setPending({ attempt: a, outcome: 'failed' });
                                setJobId('');
                                setReason('');
                              }}
                            >
                              Failed
                            </button>
                            <button
                              type="button"
                              className="qre-btn qre-btn--ghost"
                              style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }}
                              disabled={busy}
                              onClick={() => {
                                setPending({ attempt: a, outcome: 'unresolved' });
                                setJobId('');
                                setReason('');
                              }}
                            >
                              Unresolved
                            </button>
                          </span>
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
      </div>
      <ConfirmDialog
        title={
          pending?.outcome === 'confirmed'
            ? 'Confirm dispatch?'
            : pending?.outcome === 'failed'
              ? 'Mark dispatch failed?'
              : pending
                ? 'Leave dispatch unresolved?'
                : ''
        }
        body={
          pending?.outcome === 'confirmed'
            ? 'Records the external job id against this attempt. It does not start a provider job from Govern.'
            : pending
              ? 'Updates the attempt for the evidence pack. The workload approval state stays as-is.'
              : ''
        }
        confirmLabel={pending?.outcome === 'confirmed' ? 'Confirm job' : pending?.outcome === 'failed' ? 'Mark failed' : 'Mark unresolved'}
        danger={pending?.outcome === 'failed'}
        confirmDisabled={pending?.outcome === 'confirmed' && !jobId.trim()}
        onCancel={() => setPending(null)}
        onConfirm={confirmReconcile}
      >
        {pending?.outcome === 'confirmed' ? (
          <label className="qre-field">
            <span className="qre-field__label">External job id</span>
            <input className="qre-field__input govern-mono" value={jobId} onChange={(e) => setJobId(e.target.value)} required />
          </label>
        ) : null}
        {pending ? (
          <label className="qre-field">
            <span className="qre-field__label">Reason (optional)</span>
            <input className="qre-field__input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        ) : null}
      </ConfirmDialog>
    </GovernPageShell>
  );
}
