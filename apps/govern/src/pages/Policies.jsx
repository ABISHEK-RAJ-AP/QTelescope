import { useEffect, useState } from 'react';
import { api } from '../api.js';
import PolicyDryRunSummary from '../components/PolicyDryRunSummary.jsx';
import GovernPageShell from '../components/GovernPageShell.jsx';
import ListViewToolbar from '../components/ListViewToolbar.jsx';
import AdaptiveListView from '../components/AdaptiveListView.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';
import { approvalsListPath } from '../lib/approvalsQuery.js';

const POLICY_COLS = [
  { id: 'order', label: 'Order' },
  { id: 'id', label: 'Stage ID' },
  { id: 'label', label: 'Label' },
  { id: 'role', label: 'Required role' },
];

export default function Policies({ onOpen }) {
  const [policy, setPolicy] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [simWorkloadId, setSimWorkloadId] = useState('');
  const [policySim, setPolicySim] = useState(null);
  const [policySimBusy, setPolicySimBusy] = useState(false);
  const [policySimError, setPolicySimError] = useState('');
  const [queueItems, setQueueItems] = useState([]);
  const prefs = useTablePrefs('policies-stages', POLICY_COLS);

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api('/approvals/policy'), api(approvalsListPath({})).catch(() => ({ items: [] }))])
      .then(([body, queue]) => {
        setPolicy(body);
        setQueueItems(queue.items || []);
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function runDryRun(event) {
    event.preventDefault();
    const workloadId = simWorkloadId.trim();
    if (!workloadId) {
      setPolicySimError('Enter a workload ID from the approval queue.');
      return;
    }
    const policyId = policy?.policy_id || 'default-two-stage';
    setPolicySimBusy(true);
    setPolicySimError('');
    try {
      const result = await api(`/policies/${encodeURIComponent(policyId)}/dry-run`, {
        method: 'POST',
        body: JSON.stringify({ workload_id: workloadId }),
      });
      setPolicySim(result);
    } catch (e) {
      setPolicySim(null);
      setPolicySimError(String(e.message || e));
    } finally {
      setPolicySimBusy(false);
    }
  }

  const stages = policy?.stages || [];

  return (
    <GovernPageShell
      eyebrow="Governance"
      title="Policies & entitlements"
      subtitle={
        policy
          ? `Active approval policy · ${policy.policy_id || 'default'} · version ${policy.schema_version ?? policy.version ?? '—'}`
          : 'Active approval policy enforced on the server.'
      }
      loading={loading && !policy}
      error={error}
      notice={policySimError}
      noticeOk={false}
      onRetry={load}
      onOpen={onOpen}
      loadingLabel="Loading policy…"
    >
      {policy ? (
        <>
          {stages.length ? (
            <div className="govern-grid govern-grid--3">
              {stages.map((s, i) => (
                <article key={s.id || i} className="qre-card">
                  <p className="govern-muted" style={{ margin: 0 }}>
                    Stage {i + 1}
                  </p>
                  <h3 className="dashboard-card-title" style={{ marginTop: 8 }}>
                    {s.label || s.id}
                  </h3>
                  <p className="govern-muted" style={{ margin: 0 }}>
                    Required role · {s.required_role || s.role || '—'}
                  </p>
                  <p className="govern-mono" style={{ marginTop: 8 }}>
                    {s.id}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
          <div className="govern-grid govern-grid--2">
          <div className="qre-card dashboard-card">
            <p className="govern-muted" style={{ marginTop: 0 }}>
              This view is the approval workflow contract the server enforces on every submission. Quota and reservation
              records live on Usage and Reservations.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ListViewToolbar prefs={prefs} columns={POLICY_COLS} lockedIds={['order', 'label']} />
            </div>
            <AdaptiveListView
              prefs={prefs}
              items={stages}
              columns={POLICY_COLS}
              rowKey={(row) => String(row.order ?? row.stage_id ?? row.label)}
              table={
            <div className="govern-table-wrap" style={{ marginTop: 16 }}>
              <table className="govern-table">
                <thead>
                  <tr>
                    {prefs.isVisible('order') && <th>Order</th>}
                    {prefs.isVisible('id') && <th>Stage ID</th>}
                    {prefs.isVisible('label') && <th>Label</th>}
                    {prefs.isVisible('role') && <th>Required role</th>}
                  </tr>
                </thead>
                <tbody>
                  {stages.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="govern-muted">
                        No stages defined
                      </td>
                    </tr>
                  ) : (
                    stages.map((s, i) => (
                      <tr key={s.id || i}>
                        {prefs.isVisible('order') && <td>{i + 1}</td>}
                        {prefs.isVisible('id') && <td className="govern-mono">{s.id}</td>}
                        {prefs.isVisible('label') && <td>{s.label || s.id}</td>}
                        {prefs.isVisible('role') && <td>{s.required_role || s.role || '—'}</td>}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
              }
            />
          </div>

          <form className="qre-card dashboard-card govern-stack" onSubmit={runDryRun}>
            <h3 className="dashboard-card-title">Policy dry-run</h3>
            <p className="govern-muted" style={{ margin: 0 }}>
              Simulate stage routing for an existing workload without recording a decision (same API as approval detail).
            </p>
            <label className="qre-field">
              <span className="qre-field__label">Workload ID</span>
              {queueItems.length ? (
                <select
                  className="qre-field__input govern-mono"
                  value={simWorkloadId}
                  onChange={(e) => setSimWorkloadId(e.target.value)}
                >
                  <option value="">Pick from queue…</option>
                  {queueItems.map((item) => (
                    <option key={item.submission_id || item.workload_id} value={item.workload_id}>
                      {item.workload_id} · {item.governance_state}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="qre-field__input govern-mono"
                  value={simWorkloadId}
                  onChange={(e) => setSimWorkloadId(e.target.value)}
                  placeholder="From approval queue"
                />
              )}
            </label>
            <button type="submit" className="qre-btn qre-btn--primary" disabled={policySimBusy}>
              {policySimBusy ? 'Running…' : 'Run dry-run'}
            </button>
            {policySim ? <PolicyDryRunSummary result={policySim} /> : null}
          </form>
          </div>
        </>
      ) : null}
    </GovernPageShell>
  );
}
