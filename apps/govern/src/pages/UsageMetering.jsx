import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import ListViewToolbar from '../components/ListViewToolbar.jsx';
import AdaptiveListView from '../components/AdaptiveListView.jsx';
import { SparkBars } from '../components/GovernCharts.jsx';
import { EmptyState, KpiStrip, ListCap, QuotaMeter, SortTh } from '../components/ui.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';
import { downloadCsv, nextSort, relativeTime, sortBy } from '../lib/format.js';

const LEDGER_COLS = [
  { id: 'project', label: 'Project' },
  { id: 'job', label: 'Job' },
  { id: 'workload', label: 'Workload', defaultHidden: true },
  { id: 'shots', label: 'Shots' },
  { id: 'status', label: 'Status', defaultHidden: true },
  { id: 'actor', label: 'Submitted by', defaultHidden: true },
  { id: 'completed', label: 'Completed' },
];

const WINDOWS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All time' },
];

export default function UsageMetering({ onOpen }) {
  const [quota, setQuota] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [meters, setMeters] = useState(null);
  const [meterError, setMeterError] = useState('');
  const [probeShots, setProbeShots] = useState('512');
  const [probeWorkload, setProbeWorkload] = useState('');
  const [probe, setProbe] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [loadedAt, setLoadedAt] = useState(null);
  const [windowKey, setWindowKey] = useState('today');
  const [projectId, setProjectId] = useState('');
  const [includeIncomplete, setIncludeIncomplete] = useState(false);
  const [sort, setSort] = useState({ key: 'completed_at', dir: 'desc' });
  const prefs = useTablePrefs('usage-ledger', LEDGER_COLS);

  function ledgerPath() {
    const q = new URLSearchParams({ window: windowKey, limit: '200' });
    if (projectId.trim()) q.set('project_id', projectId.trim());
    if (includeIncomplete) q.set('include_incomplete', 'true');
    return `/quotas/ledger?${q}`;
  }

  function loadAll() {
    setLoading(true);
    setError('');
    setMeterError('');
    return Promise.all([
      api('/quotas/evaluate'),
      api(ledgerPath()),
      api('/meter-rollups?hours=24').catch((e) => {
        setMeterError(String(e.message || e));
        return null;
      }),
    ])
      .then(([evalBody, ledgerBody, meterBody]) => {
        setQuota(evalBody);
        setLedger(ledgerBody);
        setMeters(meterBody);
        setLoadedAt(new Date());
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAll();
    window.addEventListener('qre-role-changed', loadAll);
    return () => window.removeEventListener('qre-role-changed', loadAll);
  }, [windowKey, projectId, includeIncomplete]);

  async function runProbe(event) {
    event.preventDefault();
    const shots = parseInt(probeShots, 10);
    if (!Number.isFinite(shots) || shots < 0) return;
    setProbing(true);
    setProbe(null);
    const q = new URLSearchParams({ shots: String(shots) });
    if (probeWorkload.trim()) q.set('workload_id', probeWorkload.trim());
    if (projectId.trim()) q.set('project_id', projectId.trim());
    try {
      const body = await api(`/quotas/evaluate?${q}`);
      setProbe(body);
    } catch (e) {
      setProbe({ allowed: false, warnings: [String(e.message || e)] });
    } finally {
      setProbing(false);
    }
  }

  const warnPct = quota?.warn_threshold_pct ?? 20;
  const lowHeadroom = quota ? (quota.headroom_pct ?? 100) <= warnPct : false;
  const entries = ledger?.entries || [];
  const projects = ledger?.by_project || [];
  const visible = useMemo(
    () =>
      sortBy(entries, sort.key, sort.dir, (row) => {
        if (sort.key === 'completed_at') return row.completed_at || row.created_at || '';
        if (sort.key === 'shots') return row.shots || 0;
        return row[sort.key];
      }),
    [entries, sort],
  );
  const meterItems = Array.isArray(meters) ? meters : meters?.items || meters?.rollups || [];

  return (
    <GovernPageShell
      variant="band"
      eyebrow="Governance"
      title="Usage & metering"
      subtitle="Operational quota ledger: daily simulation-shot cap, windowed consumption, project breakdown, and connector meter rollups when present."
      loading={loading && !quota}
      error={error}
      onRetry={loadAll}
      onOpen={onOpen}
      loadingLabel="Loading tenant metering…"
      updatedAt={loadedAt ? relativeTime(loadedAt) : ''}
    >
      {quota ? (
        <>
          <KpiStrip
            items={[
              {
                key: 'cap',
                label: 'Daily cap',
                value: quota.daily_shots_cap?.toLocaleString() ?? '—',
                hint: quota.policy_id || ledger?.policy_id || 'policy',
              },
              {
                key: 'used',
                label: windowKey === 'today' ? 'Used today' : `Used (${windowKey})`,
                value: (ledger?.used_shots ?? quota.used_shots)?.toLocaleString() ?? '—',
                hint: 'Completed sims in window',
              },
              {
                key: 'lifetime',
                label: 'Lifetime used',
                value: (ledger?.used_shots_lifetime ?? quota.used_shots_lifetime)?.toLocaleString() ?? '—',
                hint: 'All completed sims',
              },
              {
                key: 'remaining',
                label: 'Remaining today',
                value: quota.remaining_shots?.toLocaleString() ?? '—',
                hint: `${quota.headroom_pct ?? 0}% headroom`,
                tone: lowHeadroom ? 'govern-kpi--tone-warn' : 'govern-kpi--tone-ok',
              },
            ]}
          />

          <QuotaMeter
            used={quota.used_shots}
            cap={quota.daily_shots_cap}
            remaining={quota.remaining_shots}
            warnPct={warnPct}
            label="Daily shot quota (today UTC)"
          />

          {entries.length > 0 ? (
            <div className="qre-card">
              <div className="govern-section-head">
                <h3 className="govern-section-title">Completed shots</h3>
                <span className="govern-muted">Last {Math.min(entries.length, 12)} jobs in window</span>
              </div>
              <SparkBars values={entries.slice(0, 12).map((row) => row.shots || 0)} />
            </div>
          ) : null}

          {projects.length > 0 ? (
            <div className="qre-card">
              <div className="govern-section-head">
                <h3 className="govern-section-title">By project</h3>
                <span className="govern-muted">{ledger.dimension_note}</span>
              </div>
              <div className="govern-table-wrap">
                <table className="govern-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Jobs</th>
                      <th>Shots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((row) => (
                      <tr key={row.project_id}>
                        <td>
                          <button
                            type="button"
                            className="govern-table__primary"
                            onClick={() => setProjectId(row.project_id)}
                          >
                            {row.project_name || row.project_id}
                          </button>
                          <span className="govern-table__sub govern-mono">{row.project_id}</span>
                        </td>
                        <td className="govern-num">{row.jobs}</td>
                        <td className="govern-num">{row.shots?.toLocaleString?.() ?? row.shots}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="qre-card dashboard-card">
            <div className="govern-section-head">
              <h3 className="dashboard-card-title">Quota ledger</h3>
              <button
                type="button"
                className="qre-btn qre-btn--ghost"
                disabled={!visible.length}
                onClick={() =>
                  downloadCsv(
                    `quota-ledger-${windowKey}.csv`,
                    ['project', 'job', 'workload', 'shots', 'status', 'created_by', 'completed_at'],
                    visible.map((row) => [
                      row.project_name || row.project_id,
                      row.job_id,
                      row.workload_id,
                      row.shots,
                      row.status,
                      row.created_by,
                      row.completed_at || row.created_at,
                    ]),
                  )
                }
              >
                Export CSV
              </button>
            </div>
            <p className="govern-muted" style={{ marginTop: 0 }}>
              Policy source: <span className="govern-mono">{ledger?.policy_source || quota.policy_id}</span>
              {ledger?.window_start ? ` · window ${new Date(ledger.window_start).toLocaleString()}` : ''}
              {ledger?.window_end ? ` → ${new Date(ledger.window_end).toLocaleString()}` : ''}
            </p>
            <div className="page-filters govern-toolbar">
              <div className="qre-tabs page-filters__grow" role="tablist" aria-label="Ledger window" style={{ marginBottom: 0, borderBottom: 'none' }}>
                {WINDOWS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={windowKey === tab.id}
                    className={`qre-tab${windowKey === tab.id ? ' qre-tab--active' : ''}`}
                    onClick={() => setWindowKey(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <input
                className="govern-search"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Project ID"
                aria-label="Filter ledger by project"
              />
              <label className="govern-muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={includeIncomplete}
                  onChange={(e) => setIncludeIncomplete(e.target.checked)}
                />
                Include incomplete
              </label>
              <ListViewToolbar prefs={prefs} columns={LEDGER_COLS} lockedIds={['project', 'shots']} />
            </div>
            {visible.length === 0 ? (
              <EmptyState title="No jobs in this window" hint="Usage increments when Build marks simulation jobs completed for this tenant." />
            ) : (
              <AdaptiveListView
                prefs={prefs}
                items={visible}
                columns={LEDGER_COLS}
                rowKey={(row) => row.job_id}
                table={
              <div className="govern-table-wrap">
                <table className="govern-table">
                  <thead>
                    <tr>
                      {prefs.isVisible('project') && <SortTh label="Project" sortKey="project_name" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                      {prefs.isVisible('job') && <SortTh label="Job" sortKey="job_id" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                      {prefs.isVisible('workload') && <th>Workload</th>}
                      {prefs.isVisible('shots') && <SortTh label="Shots" sortKey="shots" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                      {prefs.isVisible('status') && <th>Status</th>}
                      {prefs.isVisible('actor') && <th>Submitted by</th>}
                      {prefs.isVisible('completed') && <SortTh label="Completed" sortKey="completed_at" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => (
                      <tr key={row.job_id}>
                        {prefs.isVisible('project') && (
                          <td>
                            {row.project_name || row.project_id}
                            <span className="govern-table__sub govern-mono">{row.project_id}</span>
                          </td>
                        )}
                        {prefs.isVisible('job') && <td className="govern-mono">{row.job_id}</td>}
                        {prefs.isVisible('workload') && (
                          <td>
                            {row.workload_id ? (
                              <button type="button" className="govern-table__primary" onClick={() => onOpen?.(`#/queue/${row.workload_id}`)}>
                                {row.workload_id}
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                        )}
                        {prefs.isVisible('shots') && <td className="govern-num">{row.shots?.toLocaleString?.() ?? row.shots}</td>}
                        {prefs.isVisible('status') && (
                          <td>
                            {row.status}
                            {!row.counts_toward_quota ? <span className="govern-table__sub">Not counted</span> : null}
                          </td>
                        )}
                        {prefs.isVisible('actor') && <td>{row.created_by || '—'}</td>}
                        {prefs.isVisible('completed') && (
                          <td className="govern-muted">
                            {row.completed_at || row.created_at
                              ? new Date(row.completed_at || row.created_at).toLocaleString()
                              : '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ListCap count={ledger?.entry_count} cap={ledger?.limit || 200} noun="jobs" />
              </div>
                }
              />
            )}
          </div>

          <div className="qre-card dashboard-card">
            <h3 className="dashboard-card-title">Connector meter rollups</h3>
            <p className="govern-muted" style={{ marginTop: 0 }}>
              Separate from the shot quota. Shown only when `/meter-rollups` returns records.
            </p>
            {meterError ? (
              <EmptyState title="Meter rollups unavailable" hint={meterError} />
            ) : !meterItems.length ? (
              <EmptyState title="No connector meters" hint="Ingest samples from a registered connector, or open Capacity for the rollup view." />
            ) : (
              <div className="govern-table-wrap">
                <table className="govern-table">
                  <thead>
                    <tr>
                      <th>Dimension</th>
                      <th>Metric</th>
                      <th>Sum</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meterItems.map((row, i) => (
                      <tr key={`${row.dimension}-${row.metric}-${i}`}>
                        <td>{row.dimension || '—'}</td>
                        <td>{row.metric || '—'}</td>
                        <td>{row.sum_value ?? row.sum ?? row.value ?? '—'}</td>
                        <td>{row.unit || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <form className="qre-card govern-stack" onSubmit={runProbe}>
            <div className="govern-section-head">
              <h3 className="govern-section-title">Preflight a shot request</h3>
            </div>
            <p className="govern-muted" style={{ margin: 0 }}>
              Evaluates requested shots against remaining daily capacity. Optional workload ID uses that project's latest completed job when shots are omitted.
            </p>
            <div className="govern-form-grid">
              <label className="qre-field">
                <span className="qre-field__label">Requested shots</span>
                <input
                  className="qre-field__input"
                  type="number"
                  min={0}
                  value={probeShots}
                  onChange={(e) => setProbeShots(e.target.value)}
                />
              </label>
              <label className="qre-field">
                <span className="qre-field__label">Workload ID (optional)</span>
                <input
                  className="qre-field__input govern-mono"
                  value={probeWorkload}
                  onChange={(e) => setProbeWorkload(e.target.value)}
                  placeholder="wl_…"
                />
              </label>
            </div>
            <button type="submit" className="qre-btn qre-btn--primary" disabled={probing}>
              {probing ? 'Evaluating…' : 'Evaluate'}
            </button>
            {probe && (
              <div className="govern-policy-dry-run" style={{ marginTop: 8 }}>
                <span className={`govern-status ${probe.allowed ? 'govern-status--ok' : 'govern-status--bad'}`}>
                  {probe.allowed ? 'Allowed' : 'Would exceed quota'}
                </span>
                <p className="govern-muted">
                  Remaining {probe.remaining_shots?.toLocaleString?.() ?? '—'} · used today {probe.used_shots?.toLocaleString?.() ?? '—'}
                </p>
                {(probe.warnings || []).length > 0 && (
                  <ul className="govern-reason-list" style={{ marginTop: 12 }}>
                    {probe.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </form>

          {!quota.daily_shots_cap && (
            <EmptyState title="No quota policy" hint="Configure tenant shot caps in config/quota_policy.json on the server." />
          )}
        </>
      ) : null}
    </GovernPageShell>
  );
}
