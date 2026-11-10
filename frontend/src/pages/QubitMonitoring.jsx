import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { api } from '../services/api';
import { formatISTTime } from '../utils/time';
import { useTheme } from '../components/ui/ThemeProvider';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { ContextBar } from '../components/observability/ContextBar.jsx';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { baseTooltip, getChartTheme } from '../components/observability/chartTheme.js';
import { useAppScope } from '../hooks/useAppScope.js';
import { buildBackendDetailsPath } from '../lib/investigationLinks.js';
import { STATES, STATE_GLYPH, STATE_LABEL, ageMinutes, formatAge, isStale, scopeSearch } from './backendUtils.js';
import { unableToLoad } from '../constants/messages.js';
import './QubitMonitoring.css';

const PAGE_SIZE = 40;
const COLS = [
  { key: 'qubit_index', label: 'Qubit' },
  { key: 'state', label: 'Health' },
  { key: 'status', label: 'Status' },
  { key: 't1', label: 'T1', right: true },
  { key: 't2', label: 'T2', right: true },
  { key: 'readout', label: 'Readout error', right: true },
];
const dur = (v) => (v == null ? '—' : v >= 1e6 ? `${(v / 1e6).toFixed(1)} s` : v >= 1e3 ? `${(v / 1e3).toFixed(1)} ms` : `${v.toFixed(1)} µs`);

export const QubitMonitoring = () => {
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const theme = getChartTheme(isDark);
  const { backend, hours, setBackend } = useAppScope();
  const { setActions, clearActions } = usePageActions();

  const [backends, setBackends] = useState(null);
  const [data, setData] = useState({ qubits: [], hv: {}, hvOk: true });
  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [sort, setSort] = useState({ key: 'qubit_index', dir: 'asc' });
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const [hist, setHist] = useState({ rows: [], state: 'idle' });
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    api.getBackends().then((list) => {
      setBackends(list || []);
      if (list?.length && !list.some((b) => b.backend_id === backend)) setBackend(list[0].backend_id);
      if (!list?.length) setPhase('ready');
    }).catch(() => setPhase('error'));
  }, [backend, setBackend]);

  const load = useCallback(async () => {
    if (!backend) return;
    setPhase((p) => (p === 'ready' ? p : 'loading'));
    const [q, hv] = await Promise.allSettled([api.getBackendQubits(backend), api.getHealthVector()]);
    if (q.status === 'rejected') { setPhase('error'); return; }
    const hvQ = hv.status === 'fulfilled'
      ? Object.fromEntries(((hv.value.backends || []).find((b) => b.backend_id === backend)?.qubits || []).map((x) => [x.qubit_index, x]))
      : {};
    setData({ qubits: q.value || [], hv: hvQ, hvOk: hv.status === 'fulfilled' });
    setPhase('ready');
    setLastRefresh(new Date());
  }, [backend]);

  useEffect(() => { setPage(0); setSearch(''); setStateFilter('ALL'); setSelected(null); load(); }, [load]);
  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh qubits" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  useEffect(() => {
    if (selected == null || !backend) { setHist({ rows: [], state: 'idle' }); return undefined; }
    let live = true;
    setHist({ rows: [], state: 'loading' });
    api.getQubitHistory(backend, selected)
      .then((rows) => live && setHist({ rows: [...(rows || [])].reverse(), state: 'ready' }))
      .catch(() => live && setHist({ rows: [], state: 'error' }));
    return () => { live = false; };
  }, [backend, selected]);

  const rows = useMemo(() => data.qubits.map((q) => ({
    qubit_index: q.qubit_index,
    state: data.hv[q.qubit_index]?.state || 'UNKNOWN',
    status: q.status,
    t1: q.latest_t1,
    t2: q.latest_t2,
    readout: q.latest_readout_error,
    ts: q.source_timestamp,
  })), [data]);

  const counts = useMemo(() => STATES.reduce((m, s) => ({ ...m, [s]: rows.filter((r) => r.state === s).length }), {}), [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase().replace(/^q/, '');
    return rows
      .filter((r) => (stateFilter === 'ALL' || r.state === stateFilter) && (!needle || String(r.qubit_index).includes(needle)))
      .sort((a, b) => {
        const av = a[sort.key]; const bv = b[sort.key];
        if (av == null) return 1;
        if (bv == null) return -1;
        const c = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sort.dir === 'asc' ? c : -c;
      });
  }, [rows, search, stateFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const chartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: baseTooltip(isDark),
    legend: { textStyle: { color: theme.textColor }, top: 0 },
    grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: hist.rows.map((h) => formatISTTime(h.timestamp, false)), axisLine: { lineStyle: { color: theme.axisLine } }, axisLabel: { color: theme.textColor } },
    yAxis: [
      { type: 'value', name: 'Coherence (µs)', axisLine: { lineStyle: { color: theme.axisLine } }, splitLine: { lineStyle: { color: theme.splitColor } }, axisLabel: { color: theme.textColor } },
      { type: 'value', name: 'Readout error', axisLine: { lineStyle: { color: theme.axisLine } }, splitLine: { show: false }, axisLabel: { color: theme.textColor } },
    ],
    series: [
      { name: 'T1', type: 'line', smooth: true, showSymbol: false, data: hist.rows.map((h) => h.t1) },
      { name: 'T2', type: 'line', smooth: true, showSymbol: false, data: hist.rows.map((h) => h.t2) },
      { name: 'Readout error', type: 'line', yAxisIndex: 1, smooth: true, showSymbol: false, lineStyle: { type: 'dashed' }, data: hist.rows.map((h) => h.readout_error) },
    ],
  }), [isDark, theme, hist.rows]);

  const sortBtn = (c) => (
    <th key={c.key} scope="col" className={c.right ? 'bk-r' : undefined} aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="bk-th" data-active={sort.key === c.key}
        onClick={() => { setPage(0); setSort((s) => (s.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' })); }}>
        {c.label}<span aria-hidden>{sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );

  if (backends === null && phase !== 'error') return <BoneyardSkeleton layout="table" />;
  if (phase === 'error') return <ErrorState variant="panel" message={unableToLoad('qubit telemetry')} onRetry={() => { setPhase('loading'); load(); }} />;
  if (!backends.length) return <EmptyState variant="panel" title="No backends" message="Add a backend before opening qubit monitoring." />;

  const newest = rows.reduce((m, r) => (r.ts && (!m || r.ts > m) ? r.ts : m), null);
  const age = ageMinutes(newest);
  const selRow = rows.find((r) => r.qubit_index === selected);
  const histAsOf = hist.rows.length ? formatISTTime(hist.rows[hist.rows.length - 1].timestamp) : null;

  return (
    <div className="page-stack">
      <ContextBar backend={backend} backends={backends} onBackendChange={setBackend} hint="Selected backend is reflected in the page URL." />

      <section className="card bk-toolbar" aria-label="Backend qubit summary">
        <div style={{ minWidth: 220, flex: '1 1 220px' }}>
          <div className="bk-kpi__label">Qubit health</div>
          {phase === 'loading' ? <span className="bk-muted">Loading…</span> : rows.length ? (
            <div style={{ marginTop: 4 }}>
              <div className="bk-bar" role="img" aria-label={STATES.filter((s) => counts[s]).map((s) => `${counts[s]} ${STATE_LABEL[s].toLowerCase()}`).join(', ')}>
                {STATES.map((s) => (counts[s] ? <span key={s} className={`bk-seg bk-seg--${s}`} style={{ width: `${(counts[s] / rows.length) * 100}%` }} /> : null))}
              </div>
              <div className="bk-statebar__nums" style={{ marginTop: 4 }}>{STATES.filter((s) => counts[s]).map((s) => `${STATE_GLYPH[s]} ${STATE_LABEL[s]} ${counts[s]}`).join('   ')}</div>
            </div>
          ) : <span className="bk-muted">No qubits reported</span>}
        </div>
        <div>
          <div className="bk-kpi__label">Latest sample</div>
          <span className={isStale(age) && rows.length ? 'bk-stale' : undefined}>{rows.length ? `${isStale(age) ? '⚠ Stale · ' : ''}${formatAge(age)} ago` : '—'}</span>
        </div>
        <div className="qm-links">
          <Link className="btn btn-secondary" to={buildBackendDetailsPath(backend, 'qubits') + scopeSearch('', hours)}>Backend workspace</Link>
          <Link className="btn btn-secondary" to={`/app/resources/health${scopeSearch(backend, hours)}`}>Resource health</Link>
        </div>
      </section>
      {!data.hvOk && <p className="bk-note" role="status">{unableToLoad('health scores')}. All qubits show Unknown health.</p>}

      <div className="qubit-layout-grid">
        <section className="card" style={{ padding: 0, minWidth: 0 }}>
          <div className="bk-toolbar">
            <input type="search" placeholder="Qubit #" aria-label="Filter by qubit index" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} style={{ minWidth: 100, maxWidth: 130 }} />
            <label>Health
              <select className="input-control" value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setPage(0); }}>
                <option value="ALL">All</option>
                {STATES.map((s) => <option key={s} value={s}>{STATE_LABEL[s]}</option>)}
              </select>
            </label>
            <span className="bk-muted bk-toolbar__count" aria-live="polite">{filtered.length} of {rows.length} qubits{filtered.length > PAGE_SIZE ? ` · page ${safePage + 1}/${pageCount}` : ''}</span>
          </div>
          {phase === 'loading' ? <BoneyardSkeleton layout="table" /> : pageRows.length === 0 ? (
            <EmptyState variant="panel" compact title={rows.length ? 'No qubits match' : 'No qubit records'} message={rows.length ? 'Clear the filters.' : 'This backend reports no per-qubit telemetry.'} />
          ) : (
            <div className="bk-tablewrap qubit-table-wrapper">
              <table className="bk-table">
                <caption className="bk-sr">Qubits. Select a row to load its history.</caption>
                <thead><tr>{COLS.map(sortBtn)}</tr></thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.qubit_index} className="bk-row" aria-selected={selected === r.qubit_index} data-selected={selected === r.qubit_index} onClick={() => setSelected(r.qubit_index)}>
                      <td>
                        <button type="button" className="bk-link" onClick={(e) => { e.stopPropagation(); setSelected(r.qubit_index); }}>Q{r.qubit_index}</button>
                      </td>
                      <td>{STATE_GLYPH[r.state]} {STATE_LABEL[r.state]}</td>
                      <td>{r.status || '—'}</td>
                      <td className="bk-r">{dur(r.t1)}</td>
                      <td className="bk-r">{dur(r.t2)}</td>
                      <td className="bk-r">{r.readout != null ? `${(r.readout * 100).toFixed(2)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > PAGE_SIZE && (
            <div className="qm-pager">
              <button type="button" className="btn btn-secondary" disabled={safePage <= 0} onClick={() => setPage(safePage - 1)}>Previous</button>
              <button type="button" className="btn btn-secondary" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>Next</button>
            </div>
          )}
        </section>

        <ChartPanel
          title={selRow ? `Q${selRow.qubit_index} coherence & readout` : 'Qubit history'}
          titleTo={backend ? `/app/resources/health?backend=${encodeURIComponent(backend)}` : '/app/resources/health'}
          question={selRow ? `${STATE_GLYPH[selRow.state]} ${STATE_LABEL[selRow.state]} health · stored samples` : 'Select a qubit row'}
          sourceKind="cached"
          asOf={histAsOf}
          state={selected == null ? 'empty' : hist.state === 'loading' ? 'loading' : hist.state === 'error' ? 'error' : hist.rows.length > 1 ? 'ready' : 'empty'}
          emptyTitle={selected == null ? 'No qubit selected' : 'Not enough samples'}
          emptyMessage={selected == null ? 'Select a qubit row to load its history.' : 'Fewer than two stored samples; no trend to draw.'}
          errorMessage={unableToLoad('qubit history')}
          onRetry={() => setSelected((s) => { setHist({ rows: [], state: 'loading' }); return s; })}
          minHeight={280}
        >
          <QtECharts option={chartOption} style={{ height: 280 }} />
        </ChartPanel>
      </div>
    </div>
  );
};
