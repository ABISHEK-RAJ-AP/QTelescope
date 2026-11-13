import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { ArrowLeft } from 'lucide-react';
import { api, fetchApi } from '../services/api';
import { formatISTTime } from '../utils/time';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { useAppScope } from '../hooks/useAppScope.js';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { baseTooltip, getChartTheme, getChartSemanticColors } from '../components/observability/chartTheme.js';
import { BACKEND_WORKSPACE_TABS } from '../lib/investigationLinks.js';
import { STATES, STATE_GLYPH, STATE_LABEL, ageMinutes, formatAge, isStale, lineageOf, median, modalityName, num, providerName, scopeSearch, useProviderLineage } from './backendUtils.js';
import { LineageTag, Sparkline, StateBar, StatusText } from './backendCommon.jsx';
import { ListPager } from '../components/observability/ListPager.jsx';
import { unableToLoad, unableToLoadLabel } from '../constants/messages.js';
import { formatBackendTitle } from '../lib/displayLabels.js';
import './BackendDetails.css';

const TAB_LABEL = { overview: 'Overview', qubits: 'Qubits', calibration: 'Calibration', connectivity: 'Connectivity', execution: 'Execution' };
const PAGE_SIZE = 25;
const JOB_PAGE_SIZE = 15;
const label = (k) => String(k).replace(/_/g, ' ');

/** Durations arrive in µs; trapped-ion T1 is seconds-scale. */
const fmtDur = (us) => {
  if (us == null || !Number.isFinite(us)) return '—';
  if (us >= 1e6) return `${(us / 1e6).toFixed(1)} s`;
  if (us >= 1e3) return `${(us / 1e3).toFixed(1)} ms`;
  return `${us.toFixed(1)} µs`;
};

function histogram(values, bins = 16) {
  const v = values.filter((x) => x != null && Number.isFinite(x));
  if (!v.length) return null;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const w = (hi - lo) / bins || 1e-9;
  const counts = Array(bins).fill(0);
  v.forEach((x) => { counts[Math.min(bins - 1, Math.floor((x - lo) / w))] += 1; });
  return { lo, w, counts, n: v.length, med: median(v) };
}

function GateHistogram({ title, values }) {
  const { resolved } = useTheme();
  const th = getChartTheme(resolved === 'dark');
  const h = useMemo(() => histogram(values), [values]);
  const flat = h && h.counts.filter(Boolean).length === 1;
  const option = useMemo(() => {
    if (!h) return null;
    const sem = getChartSemanticColors();
    return {
      grid: { left: 44, right: 12, top: 12, bottom: 44 },
      tooltip: { ...baseTooltip(resolved === 'dark'), trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'category', name: 'Error rate', nameLocation: 'middle', nameGap: 30, nameTextStyle: { color: th.textColor },
        data: h.counts.map((_, i) => `${((h.lo + h.w * i) * 100).toFixed(2)}%`),
        axisLabel: { color: th.textColor, fontSize: 10, interval: 3 }, axisLine: { lineStyle: { color: th.axisLine } },
      },
      yAxis: { type: 'value', name: 'Qubits', nameTextStyle: { color: th.textColor }, minInterval: 1, axisLabel: { color: th.textColor }, splitLine: { lineStyle: { color: th.splitColor } } },
      series: [{ type: 'bar', data: h.counts, itemStyle: { color: sem.accent }, barCategoryGap: '8%' }],
    };
  }, [h, th, resolved]);
  return (
    <ChartPanel
      title={title}
      question={h ? `Median ${(h.med * 100).toFixed(3)}% · ${h.n} qubits` : undefined}
      sourceKind="derived"
      state={h && !flat ? 'ready' : 'empty'}
      emptyTitle={flat ? 'No spread across qubits' : 'No fidelity data'}
      emptyMessage={flat ? `All ${h.n} qubits report the same error (${(h.med * 100).toFixed(3)}%), so there is no distribution to plot.` : 'Health vector has no fidelity for this backend.'}
      minHeight={220}
      tableAlternative={null}
    >
      {option && <QtECharts option={option} style={{ height: 220 }} />}
    </ChartPanel>
  );
}

export const BackendDetails = ({ backendId, workspaceTab = 'overview', onWorkspaceTabChange, onBack }) => {
  const nav = useNavigate();
  const activeTab = BACKEND_WORKSPACE_TABS.includes(workspaceTab) ? workspaceTab : 'overview';
  const { hours } = useAppScope();
  const scope = scopeSearch(backendId, hours);
  const lineage = useProviderLineage();
  const { setActions, clearActions } = usePageActions();

  const [d, setD] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | notfound | error
  const [lastRefresh, setLastRefresh] = useState(null);
  const [qSort, setQSort] = useState({ key: 'qubit_index', dir: 'asc' });
  const [qSearch, setQSearch] = useState('');
  const [qState, setQState] = useState('ALL');
  const [qPage, setQPage] = useState(0);
  const [jPage, setJPage] = useState(1);

  const load = useCallback(async () => {
    if (!backendId) return;
    const forId = backendId;
    setState('loading');
    let backend;
    try {
      backend = await api.getBackendDetail(forId);
    } catch (e) {
      if (forId !== backendId) return;
      setState(/404|not found/i.test(String(e?.message)) ? 'notfound' : 'error');
      return;
    }
    if (forId !== backendId) return;
    if (!backend) { setState('notfound'); return; }
    const names = ['status', 'qubits', 'calibration', 'calibration history', 'connectivity', 'jobs', 'queue', 'telemetry', 'qubit health', 'alerts'];
    const res = await Promise.allSettled([
      api.getBackendStatus(backendId),
      api.getBackendQubits(backendId),
      api.getBackendCalibration(backendId),
      api.getCalibrationHistory(backendId),
      api.getBackendConnectivity(backendId),
      api.getJobs(backendId),
      api.getBackendQueue(backendId),
      api.getBackendTelemetry(backendId),
      api.getHealthVector(),
      fetchApi('/alerts?limit=500'), // API cannot filter by backend; filter client-side
    ]);
    const failed = [];
    const v = (i) => { if (res[i].status === 'fulfilled') return res[i].value; failed.push(names[i]); return null; };
    const [status, qubits, calibration, calHist, conn, jobs, queue, telemetry, hvAll, alerts] = names.map((_, i) => v(i));
    if (forId !== backendId) return;
    const hv = (hvAll?.backends || []).find((b) => b.backend_id === forId) || null;
    const infra = backend.provider_id === 'cdac_quantum'
      ? await api.getClassicalInfra(forId).catch(() => null) : null;
    const iq = await api.getIngestionQuality(5, backend.provider_id).catch(() => null);
    const ingestionQuality = iq?.reports?.[0] ?? null;
    setD({
      backend, status, qubits: qubits || [], calibration, calHist: calHist || [], conn: conn || [], jobs: jobs || [],
      queue, telemetry: telemetry || [], hv, infra, failed,
      alerts: (alerts || []).filter((a) => a.backend_id === forId),
      alertsOk: !!alerts,
      ingestionQuality,
    });
    if (forId !== backendId) return;
    setLastRefresh(new Date());
    setState('ready');
  }, [backendId]);

  useEffect(() => { setD(null); setState('loading'); setQPage(0); setJPage(1); load(); }, [load]);
  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh backend" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  const hvQubits = useMemo(() => d?.hv?.qubits || [], [d]);
  const qubitRows = useMemo(() => {
    if (!d) return [];
    const byIdx = Object.fromEntries(hvQubits.map((q) => [q.qubit_index, q]));
    return d.qubits.map((q) => ({
      qubit_index: q.qubit_index,
      state: byIdx[q.qubit_index]?.state || 'UNKNOWN',
      status: q.status,
      t1: q.latest_t1,
      t2: q.latest_t2,
      readout: q.latest_readout_error,
      f2q: byIdx[q.qubit_index]?.F_2q,
      reasons: (byIdx[q.qubit_index]?.reasons || []).join('; '),
    }));
  }, [d, hvQubits]);

  const worstQubits = useMemo(() => {
    const rank = { RED: 0, YELLOW: 1, GREEN: 2, UNKNOWN: 3 };
    return [...qubitRows].sort((a, b) => (rank[a.state] ?? 9) - (rank[b.state] ?? 9) || a.qubit_index - b.qubit_index).slice(0, 12);
  }, [qubitRows]);

  if (!backendId) {
    return <EmptyState variant="panel" title="No backend selected" message="Choose a backend from the library to open its workspace." action={<Link className="btn btn-primary" to="/app/backends/inventory">Open library</Link>} />;
  }
  if (state === 'loading') return <BoneyardSkeleton layout="backend" />;
  if (state === 'notfound') return <EmptyState variant="panel" title={`Backend “${backendId}” not found`} message="It is not in the registry." action={<Link className="btn btn-primary" to="/app/backends/inventory">Back to inventory</Link>} />;
  if (state === 'error' || !d) return <ErrorState variant="panel" message={unableToLoad('this backend workspace')} onRetry={load} />;

  const { backend, status, calibration, conn, jobs, queue, telemetry, hv, infra, alerts } = d;
  const src = lineageOf(lineage.map, backend.provider_id);
  const lastTs = telemetry.length ? telemetry[telemetry.length - 1].timestamp : status?.updated_at;
  const age = ageMinutes(lastTs);
  const stale = isStale(age);
  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE');
  const pendingSeries = telemetry.slice(-60).map((t) => t.pending_jobs);
  const waitSeries = telemetry.slice(-60).map((t) => t.estimated_wait_time);
  const pending = queue?.pending_jobs ?? status?.pending_jobs;
  const wait = queue?.estimated_wait_time ?? status?.estimated_wait_time;
  const t1Med = median(d.qubits.map((q) => q.latest_t1));
  const roMed = median(d.qubits.map((q) => q.latest_readout_error));
  const calAgeH = calibration?.calibration_age;
  const link = (path) => `${path}${scope}`;

  const events = [
    ...alerts.map((a) => ({ id: a.alert_id, ts: a.detected_at, text: `${a.alert_type} · ${a.message}`, sev: a.severity, tail: a.status })),
    ...[...d.calHist].sort((a, b) => parseTs(b.calibration_timestamp) - parseTs(a.calibration_timestamp)).slice(0, 5).map((c) => ({ id: `cal-${c.id}`, ts: c.calibration_timestamp, text: `Calibration ${c.calibration_identifier || ''} recorded (${c.freshness_status})`, tail: 'CALIBRATION' })),
  ].sort((a, b) => (parseTs(b.ts) - parseTs(a.ts))).slice(0, 8);

  const needle = qSearch.trim().toLowerCase().replace(/^q/, '');
  const qFiltered = qubitRows
    .filter((q) => (qState === 'ALL' || q.state === qState) && (!needle || String(q.qubit_index) === needle))
    .sort((a, b) => {
      const av = a[qSort.key]; const bv = b[qSort.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      const c = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return qSort.dir === 'asc' ? c : -c;
    });
  const qPages = Math.max(1, Math.ceil(qFiltered.length / PAGE_SIZE));
  const qp = Math.min(qPage, qPages - 1);
  const qShown = qFiltered.slice(qp * PAGE_SIZE, (qp + 1) * PAGE_SIZE);
  const sortBtn = (key, text, right) => (
    <th scope="col" className={right ? 'bk-r' : undefined} aria-sort={qSort.key === key ? (qSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="bk-th" data-active={qSort.key === key}
        onClick={() => { setQPage(0); setQSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })); }}>
        {text}<span aria-hidden>{qSort.key === key ? (qSort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );

  // gate error = 1 - fidelity (health vector is per-qubit; API exposes no per-gate table)
  const err1 = hvQubits.map((q) => (q.F_1q != null ? 1 - q.F_1q : null));
  const err2 = hvQubits.map((q) => (q.F_2q != null ? 1 - q.F_2q : null));
  const ext = backend.modality_extensions && typeof backend.modality_extensions === 'object' ? Object.entries(backend.modality_extensions) : [];
  const degree = {};
  conn.forEach((e) => { degree[e.source_qubit] = (degree[e.source_qubit] || 0) + 1; degree[e.target_qubit] = (degree[e.target_qubit] || 0) + 1; });
  const degs = Object.values(degree);
  const unlinked = Math.max(0, (backend.qubit_count || 0) - degs.length);
  const jobCounts = jobs.reduce((m, j) => ({ ...m, [j.status]: (m[j.status] || 0) + 1 }), {});
  const jPages = Math.max(1, Math.ceil(jobs.length / JOB_PAGE_SIZE));
  const jCur = Math.min(jPage, jPages);
  const jobsShown = jobs.slice((jCur - 1) * JOB_PAGE_SIZE, jCur * JOB_PAGE_SIZE);
  const calHistSorted = [...d.calHist].sort((a, b) => parseTs(b.calibration_timestamp) - parseTs(a.calibration_timestamp));
  const secErr = (name) => d.failed.includes(name);

  return (
    <div className="page-stack">
      <header className="card bd-head">
        <div className="bd-head__id">
          <h2 className="bd-title">
            {onBack && <button type="button" className="btn btn-secondary" onClick={onBack}><ArrowLeft size={14} aria-hidden /> Inventory</button>}
            <span>{formatBackendTitle(backend)}</span>
          </h2>
          <p className="bd-meta">
            {providerName(backend.provider_id)} · {modalityName(backend.qpu_modality)} · {backend.qubit_count} qubits
            {backend.quantum_volume ? ` · QV ${backend.quantum_volume}` : ''}{backend.clops ? ` · CLOPS ${backend.clops}` : ''}
          </p>
          <div className="bd-badges">
            <StatusText status={backend.operational_status} />
            {hv && (
              <span className="bd-health" data-s={hv.router} title={`Advisory router: ${hv.recommended_action || 'n/a'}`}>
                Health {STATE_LABEL[hv.router] || hv.router}
              </span>
            )}
            <LineageTag lineage={src} compact />
          </div>
          <dl className="bd-facts">
            <div>
              <dt>Telemetry</dt>
              <dd className={stale ? 'bd-facts--warn' : undefined}>{stale ? 'Stale' : 'Fresh'} · {formatAge(age)} ago</dd>
            </div>
            {calibration?.freshness_status ? (
              <div><dt>Calibration</dt><dd>{calibration.freshness_status}</dd></div>
            ) : null}
            {d.ingestionQuality ? (
              <div>
                <dt>Ingestion</dt>
                <dd>
                  <button type="button" className="bd-facts__link" onClick={() => nav('/app/admin/collectors')}>
                    {d.ingestionQuality.quality_outcome || d.ingestionQuality.status}
                    {d.ingestionQuality.completeness_pct != null ? ` · ${d.ingestionQuality.completeness_pct}%` : ''}
                  </button>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        <nav className="bd-actions" aria-label="Related views">
          <Link className="btn btn-primary" to={link('/app/investigate/timeline')}>Ops timeline</Link>
        </nav>
      </header>

      {(d.failed.length > 0 || lineage.error) && (
        <p className="bk-note" role="status">Partial data: {[...d.failed, ...(lineage.error ? ['adapter lineage'] : [])].join(', ')} could not load. Affected sections say so.</p>
      )}

      <div className="bd-tabs" role="tablist" aria-label="Backend workspace">
        {BACKEND_WORKSPACE_TABS.map((tab) => (
          <button key={tab} type="button" role="tab" id={`bd-tab-${tab}`} aria-selected={activeTab === tab} aria-controls="bd-panel" tabIndex={activeTab === tab ? 0 : -1}
            className="bd-tab" onClick={() => onWorkspaceTabChange?.(tab)}
            onKeyDown={(e) => {
              const i = BACKEND_WORKSPACE_TABS.indexOf(tab);
              const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
              if (n == null) return;
              const next = BACKEND_WORKSPACE_TABS[(n + BACKEND_WORKSPACE_TABS.length) % BACKEND_WORKSPACE_TABS.length];
              onWorkspaceTabChange?.(next);
              requestAnimationFrame(() => document.getElementById(`bd-tab-${next}`)?.focus());
            }}>
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      <div id="bd-panel" role="tabpanel" aria-labelledby={`bd-tab-${activeTab}`} className="page-stack">
        {activeTab === 'overview' && (
          <>
            <section className="bk-kpis bd-overview-kpis" aria-label="Key metrics">
              <div className="bk-kpi bd-spark-kpi">
                <div className="bk-kpi__label">Pending jobs</div>
                <div className="bk-kpi__value">{pending ?? '—'}</div>
                <Sparkline values={pendingSeries} label="Pending jobs" />
              </div>
              <div className="bk-kpi bd-spark-kpi">
                <div className="bk-kpi__label">Est. wait</div>
                <div className="bk-kpi__value">{wait != null ? `${Math.round(wait)} s` : '—'}</div>
                <Sparkline values={waitSeries} label="Estimated wait" />
              </div>
              <div className="bk-kpi">
                <div className="bk-kpi__label">Median T1</div>
                <div className="bk-kpi__value">{fmtDur(t1Med)}</div>
                <div className="bk-kpi__sub">Latest snapshot · no stored series</div>
              </div>
              <div className="bk-kpi">
                <div className="bk-kpi__label">Median readout error</div>
                <div className="bk-kpi__value">{roMed != null ? `${(roMed * 100).toFixed(2)}%` : '—'}</div>
                <div className="bk-kpi__sub">Latest snapshot</div>
              </div>
              <div className="bk-kpi">
                <div className="bk-kpi__label">Calibration age</div>
                <div className="bk-kpi__value">{calAgeH != null ? `${num(calAgeH, 1)} h` : '—'}</div>
                <div className="bk-kpi__sub">{calibration?.freshness_status || (secErr('calibration') ? unableToLoadLabel('calibration') : 'No calibration record')}</div>
              </div>
              <div className={`bk-kpi${activeAlerts.length ? ' bk-kpi--warn' : ''}`}>
                <div className="bk-kpi__label">Active alerts</div>
                <div className="bk-kpi__value">{d.alertsOk ? activeAlerts.length : '—'}</div>
                <div className="bk-kpi__sub">{d.alertsOk ? 'This backend' : 'Alerts unavailable'}</div>
              </div>
            </section>

            <div className="bd-grid">
              <section className="card bd-panel" aria-label="Active alerts">
                <h3>Active alerts <Link className="bd-link" to={link('/app/alerts')}>All alerts</Link></h3>
                {!d.alertsOk ? <ErrorState variant="inline" message={unableToLoad('alerts for this backend')} onRetry={load} />
                  : activeAlerts.length === 0 ? <p className="page-hint">No active alerts for this backend.</p> : (
                    <ul className="bd-list">
                      {activeAlerts.slice(0, 6).map((a) => (
                        <li key={a.alert_id}>
                          <span className="bd-list__main">
                            <span className="bd-sev" data-s={a.severity}>
                              <span aria-hidden>{a.severity === 'CRITICAL' ? '◆' : '▲'}</span>
                              {a.severity}
                            </span>
                            <span>{a.message}</span>
                          </span>
                          <span className="bd-list__time">{formatAge(ageMinutes(a.detected_at))} ago</span>
                        </li>
                      ))}
                      {activeAlerts.length > 6 && <li><span className="page-hint">+ {activeAlerts.length - 6} more</span></li>}
                    </ul>
                  )}
              </section>

              <section className="card bd-panel" aria-label="Recent events">
                <h3>Recent events <Link className="bd-link" to={link('/app/investigate/timeline')}>Timeline</Link></h3>
                {events.length === 0 ? <p className="page-hint">No alerts or calibrations recorded.</p> : (
                  <ul className="bd-list">
                    {events.map((e) => (
                      <li key={e.id}>
                        <span className="bd-list__main">{e.sev && <span className="bd-sev" data-s={e.sev}>{e.sev}</span>}{e.text}</span>
                        <span className="bd-list__time" title={formatISTTime(e.ts)}>{formatAge(ageMinutes(e.ts))} ago · {e.tail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card bd-panel" aria-label="Specifications">
                <h3>Specifications</h3>
                <dl className="bd-props">
                  <dt>Topology</dt><dd>{label(backend.topology_type || '—')}</dd>
                  <dt>Native gates</dt><dd>{backend.basis_gates?.join(', ') || '—'}</dd>
                  <dt>Config version</dt><dd>{backend.configuration_version || '—'}</dd>
                  <dt>Status message</dt><dd>{status?.status_message || backend.status_message || '—'}</dd>
                  {ext.map(([k, val]) => (<React.Fragment key={k}><dt>{label(k)}</dt><dd>{String(val)}</dd></React.Fragment>))}
                </dl>
              </section>

              <section className="card bd-panel" aria-label="Qubit health">
                <h3>Qubit health <Link className="bd-link" to={link('/app/resources/health')}>Resource health</Link></h3>
                {hv?.counts ? <StateBar counts={hv.counts} label={backend.backend_name} /> : <p className="page-hint">{secErr('qubit health') ? unableToLoad('qubit health scores') : 'No health vector for this backend.'}</p>}
                {infra && (
                  <dl className="bd-props" style={{ marginTop: 14 }}>
                    <dt>CPU</dt><dd>{infra.cpu_util_pct}% · {infra.mpi_ranks_active} MPI ranks</dd>
                    <dt>Memory</dt><dd>{infra.memory_used_gib} / {infra.memory_cap_gib} GiB</dd>
                    <dt>GPU</dt><dd>{infra.gpu_util_pct}% avg · {infra.gpu_count} devices</dd>
                  </dl>
                )}
              </section>
            </div>
          </>
        )}

        {activeTab === 'qubits' && (
          d.qubits.length === 0 ? (
            <EmptyState variant="panel" title={secErr('qubits') ? unableToLoadLabel('qubit records') : 'No qubit records'} message={secErr('qubits') ? 'Use Refresh on the page header.' : 'This backend has no qubit telemetry (simulators may not report per-qubit data).'} />
          ) : (
            <>
              <section className="card bd-panel" aria-label="Qubit map">
                <h3>Qubit map <Link className="bd-link" to={link('/app/resources/health')}>Open in Resource health</Link></h3>
                <div className="bd-hm">
                  {qubitRows.map((q) => (
                    <Link key={q.qubit_index} className="bd-cell" data-s={q.state} to={link('/app/resources/health')}
                      title={`Q${q.qubit_index} · ${q.state} · T1 ${fmtDur(q.t1)}`} aria-label={`Qubit ${q.qubit_index}, ${q.state}`}>{q.qubit_index}</Link>
                  ))}
                </div>
                <div className="bd-legend">
                  {STATES.map((s) => <span key={s}>{STATE_GLYPH[s]} {STATE_LABEL[s]}{s === 'YELLOW' ? ' (dot marker)' : s === 'RED' ? ' (diamond marker)' : s === 'UNKNOWN' ? ' (hatched)' : ''}</span>)}
                </div>
                {!hv && <p className="page-hint" style={{ marginTop: 8 }}>No health scoring available: all qubits shown as Unknown.</p>}
              </section>

              <section className="card" style={{ padding: 0 }}>
                <div className="bk-toolbar">
                  <label className="outline-field">
                    <span>Qubit</span>
                    <input type="search" className="input-control" placeholder="#" aria-label="Find qubit by index" value={qSearch} onChange={(e) => { setQSearch(e.target.value); setQPage(0); }} />
                  </label>
                  <label className="outline-field">
                    <span>State</span>
                    <select className="input-control" value={qState} onChange={(e) => { setQState(e.target.value); setQPage(0); }}>
                      <option value="ALL">All</option>{STATES.map((s) => <option key={s} value={s}>{STATE_LABEL[s]}</option>)}
                    </select>
                  </label>
                  <span className="bk-muted bk-toolbar__count" aria-live="polite">{qFiltered.length} of {qubitRows.length} qubits</span>
                </div>
                <div className="bk-tablewrap">
                  <table className="bk-table">
                    <caption className="bk-sr">Qubits for {backend.backend_name}</caption>
                    <thead><tr>{sortBtn('qubit_index', 'Qubit')}{sortBtn('state', 'Health')}{sortBtn('status', 'Status')}{sortBtn('t1', 'T1', true)}{sortBtn('t2', 'T2', true)}{sortBtn('readout', 'Readout err', true)}{sortBtn('f2q', '2Q fidelity', true)}<th scope="col">Reason</th></tr></thead>
                    <tbody>
                      {qShown.length === 0 && <tr><td colSpan={8} className="bk-muted">No qubits match.</td></tr>}
                      {qShown.map((q) => (
                        <tr key={q.qubit_index}>
                          <td><Link className="bd-link" to={link('/app/resources/health')}>Q{q.qubit_index}</Link></td>
                          <td>{STATE_GLYPH[q.state]} {STATE_LABEL[q.state]}</td>
                          <td>{q.status || '—'}</td>
                          <td className="bk-r">{fmtDur(q.t1)}</td>
                          <td className="bk-r">{fmtDur(q.t2)}</td>
                          <td className="bk-r">{q.readout != null ? `${(q.readout * 100).toFixed(2)}%` : '—'}</td>
                          <td className="bk-r">{q.f2q != null ? q.f2q.toFixed(4) : '—'}</td>
                          <td className="bk-muted">{q.reasons || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {qPages > 1 && (
                  <div className="bd-pager">
                    <span className="bk-muted">Page {qp + 1} / {qPages}</span>
                    <button type="button" className="btn btn-secondary" disabled={qp <= 0} onClick={() => setQPage(qp - 1)}>Previous</button>
                    <button type="button" className="btn btn-secondary" disabled={qp >= qPages - 1} onClick={() => setQPage(qp + 1)}>Next</button>
                  </div>
                )}
              </section>
            </>
          )
        )}

        {activeTab === 'calibration' && (
          <div data-tour="page-backend-calibration">
            {calibration ? (
              <section className="card bd-panel" aria-label="Calibration freshness">
                <h3>Calibration freshness <Link className="bd-link" to={link('/app/telemetry/calibration')}>Calibration status</Link></h3>
                <dl className="bd-props">
                  <dt>Freshness</dt><dd><span className={`badge ${calibration.freshness_status === 'Fresh' ? 'badge-fresh' : 'badge-warning'}`}>{calibration.freshness_status}</span></dd>
                  <dt>Calibrated at</dt><dd>{formatISTTime(calibration.calibration_timestamp)}</dd>
                  <dt>Age</dt><dd className="bd-num">{num(calibration.calibration_age, 2)} h</dd>
                  <dt>Identifier</dt><dd><code>{calibration.calibration_identifier || '—'}</code></dd>
                  {Object.entries(calibration.metrics_summary || {}).map(([k, val]) => (<React.Fragment key={k}><dt>{label(k)}</dt><dd>{val == null ? '—' : String(val)}</dd></React.Fragment>))}
                </dl>
              </section>
            ) : (
              <EmptyState variant="panel" title={secErr('calibration') ? unableToLoadLabel('calibration') : 'No calibration record'} message={secErr('calibration') ? 'Use Refresh on the page header.' : 'Collectors have not stored a calibration for this backend.'} />
            )}
            <div className="bd-grid">
              <GateHistogram title="1-qubit gate error distribution" values={err1} />
              <GateHistogram title="2-qubit gate error distribution" values={err2} />
            </div>
            <p className="page-hint">Gate error shown as 1 − per-qubit fidelity from the health vector. Per-gate calibration tables are not available for this backend.</p>
            {d.calHist.length > 0 && (
              <section className="card" style={{ padding: 0 }}>
                <div className="bk-tablewrap">
                  <table className="bk-table">
                    <caption className="bk-sr">Calibration history</caption>
                    <thead><tr><th scope="col">Calibrated at</th><th scope="col">Identifier</th><th scope="col" className="bk-r">Age (h)</th><th scope="col">Freshness</th></tr></thead>
                    <tbody>
                      {calHistSorted.slice(0, 8).map((c) => (
                        <tr key={c.id}><td>{formatISTTime(c.calibration_timestamp)}</td><td><code>{c.calibration_identifier}</code></td><td className="bk-r">{num(c.calibration_age, 2)}</td><td>{c.freshness_status}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === 'connectivity' && (
          <div className="bd-connect-grid">
            <section className="card bd-panel" aria-label="Connectivity">
              <h3>Coupling map</h3>
              {conn.length === 0 ? (
                <EmptyState variant="inline" compact title={secErr('connectivity') ? unableToLoadLabel('coupling edges') : 'No coupling edges'} message={backend.topology_type === 'all_to_all' ? 'All-to-all topology: every qubit pair is coupled, edges are not stored.' : 'The registry has no edges for this backend.'} />
              ) : (
                <dl className="bd-props">
                  <dt>Topology</dt><dd>{label(backend.topology_type || '—')}</dd>
                  <dt>Edges</dt><dd className="bd-num">{conn.length}</dd>
                  <dt>Qubits with links</dt><dd className="bd-num">{degs.length} of {backend.qubit_count}{unlinked ? ` (${unlinked} unlinked)` : ''}</dd>
                  <dt>Degree (avg / max)</dt><dd className="bd-num">{num(degs.reduce((a, b) => a + b, 0) / (degs.length || 1), 2)} / {degs.length ? Math.max(...degs) : 0}</dd>
                </dl>
              )}
              <div className="bd-cta link-row">
                <Link className="btn btn-primary" to={link('/app/telemetry/topology')}>Open topology map</Link>
              </div>
            </section>
            <section className="card bd-panel" aria-label="Qubit health and coupling context">
              <h3>Qubit health on this backend</h3>
              {hv?.counts ? (
                <>
                  <StateBar counts={hv.counts} label={backend.backend_name} />
                  {qubitRows.length > 0 && (
                    <>
                      <p className="page-hint" style={{ margin: '12px 0 8px' }}>Health map — colour = state; open Qubits tab for full table.</p>
                      <div className="bd-hm bd-hm--compact">
                        {qubitRows.map((q) => (
                          <Link key={q.qubit_index} className="bd-cell" data-s={q.state} to={link('/app/resources/health')}
                            title={`Q${q.qubit_index} · ${q.state}`} aria-label={`Qubit ${q.qubit_index}, ${q.state}`}>{q.qubit_index}</Link>
                        ))}
                      </div>
                    </>
                  )}
                  {worstQubits.some((q) => q.state === 'RED' || q.state === 'YELLOW') && (
                    <div className="bd-connect-worst">
                      <span className="bk-filter-group__title">Attention qubits</span>
                      <ul className="bd-connect-worst__list">
                        {worstQubits.filter((q) => q.state === 'RED' || q.state === 'YELLOW').slice(0, 8).map((q) => (
                          <li key={q.qubit_index}><span className="bd-sev" data-s={q.state === 'RED' ? 'CRITICAL' : 'WARNING'}>{q.state}</span> Q{q.qubit_index}{q.reasons ? <span className="bk-muted"> — {q.reasons}</span> : null}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState variant="inline" compact title={secErr('qubit health') ? unableToLoadLabel('qubit health') : 'No health vector'} message="Open Resource health for fleet-wide scoring." />
              )}
              <div className="bd-cta link-row">
                <button type="button" className="btn btn-secondary btn--xs" onClick={() => onWorkspaceTabChange?.('qubits')}>Qubits tab</button>
                <Link className="fs-link" to={link('/app/resources/health')}>Resource health</Link>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'execution' && (
          <>
            <section className="bk-kpis" aria-label="Queue">
              <div className="bk-kpi bd-spark-kpi"><div className="bk-kpi__label">Pending jobs</div><div className="bk-kpi__value">{pending ?? '—'}</div><Sparkline values={pendingSeries} label="Pending jobs" /></div>
              <div className="bk-kpi bd-spark-kpi"><div className="bk-kpi__label">Est. wait</div><div className="bk-kpi__value">{wait != null ? `${Math.round(wait)} s` : '—'}</div><Sparkline values={waitSeries} label="Estimated wait" /></div>
              <div className="bk-kpi"><div className="bk-kpi__label">Queue condition</div><div className="bk-kpi__value" style={{ fontSize: 18 }}>{queue?.queue_condition || (secErr('queue') ? 'Unavailable' : '—')}</div><div className="bk-kpi__sub">Trend {queue?.trend || '—'}</div></div>
              <div className="bk-kpi"><div className="bk-kpi__label">Recent jobs</div><div className="bk-kpi__value">{jobs.length}</div><div className="bk-kpi__sub">{Object.entries(jobCounts).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(' · ') || 'None'}</div></div>
            </section>
            <section className="card" style={{ padding: 0 }}>
              <div className="bk-toolbar link-row bd-jobs-head">
                <strong style={{ fontSize: 13 }}>Jobs on this backend</strong>
                <span className="bk-muted" role="status">{jobs.length} job{jobs.length === 1 ? '' : 's'}</span>
                <Link className="fs-link" to={link('/app/execution/jobs')}>All jobs</Link>
                <Link className="fs-link" to={link('/app/execution/queues')}>Queues</Link>
              </div>
              {jobs.length === 0 ? (
                <EmptyState variant="panel" compact title={secErr('jobs') ? unableToLoadLabel('jobs') : 'No jobs'} message={secErr('jobs') ? 'Use Refresh on the page header.' : 'No job records for this backend.'} />
              ) : (
                <>
                  <div className="bk-tablewrap">
                    <table className="bk-table">
                      <caption className="bk-sr">Recent jobs</caption>
                      <thead><tr><th scope="col">Job</th><th scope="col">Status</th><th scope="col">Submitted</th><th scope="col" className="bk-r">Runtime</th><th scope="col">Tags</th></tr></thead>
                      <tbody>
                        {jobsShown.map((j) => (
                          <tr key={j.job_id}>
                            <td><code>{j.job_id}</code></td>
                            <td>{j.status === 'COMPLETED' ? '● ' : j.status === 'FAILED' ? '◆ ' : '▲ '}{j.status}{j.failure_reason ? <div className="bk-muted">{j.failure_reason}</div> : null}</td>
                            <td>{formatISTTime(j.submitted_at)}</td>
                            <td className="bk-r">{j.runtime != null ? `${j.runtime.toFixed(1)} s` : '—'}</td>
                            <td className="bk-muted">{j.tags?.join(', ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bd-pager">
                    <ListPager page={jCur} pages={jPages} onPage={setJPage} />
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

function parseTs(ts) {
  const t = Date.parse(ts && !/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? `${ts}Z` : ts);
  return Number.isFinite(t) ? t : 0;
}
