import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import {
  Maximize2, Search, X, ArrowUpDown, Clock, Activity,
  Zap, AlertTriangle, Info, ChevronDown, GitCompare,
} from 'lucide-react';
import { api } from '../services/api';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { ChartPanel, EmptyState, getChartTheme, baseTooltip, DetailDrawer } from '../components/observability';
import { getFleetStateChartColors, getChartInkColor, getChartSemanticColors } from '../components/observability/chartTheme.js';
import { unableToLoad } from '../constants/messages.js';
import { buildBackendDetailsPath } from '../lib/investigationLinks.js';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { formatISTTime } from '../utils/time';
import './TopologyExplorer.css';

const STATE_SYMBOL = { GREEN: 'circle', YELLOW: 'diamond', RED: 'triangle', UNKNOWN: 'rect' };
const stateColors = () => getFleetStateChartColors();
const LEGACY = { Healthy: 'GREEN', Warning: 'YELLOW', Degraded: 'RED' };
const fmt = (v, d = 2) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(d));
const fmtUs = (v) => {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} s`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} ms`;
  return `${n.toFixed(1)} µs`;
};

const COLOR_MODES = [
  { value: 'state', label: 'Health state' },
  { value: 't1', label: 'T1 coherence' },
  { value: 't2', label: 'T2 coherence' },
  { value: 'readout', label: 'Readout error' },
  { value: 'freq', label: 'Frequency' },
  { value: 'cal_age', label: 'Calibration age' },
];

// Synthetic layout: seeded grid + 120 spring iterations, O(n²·iter), fine to ~300 qubits.
function layoutNodes(nodes, links) {
  const n = nodes.length;
  const cols = Math.ceil(Math.sqrt(n * 1.6));
  const idx = new Map(nodes.map((q, i) => [q.id, i]));
  const pos = nodes.map((_, i) => [(i % cols) * 40, Math.floor(i / cols) * 40]);
  const edges = links.map((l) => [idx.get(String(l.source)), idx.get(String(l.target))]).filter(([a, b]) => a != null && b != null);
  const k = 40;
  for (let it = 0; it < 120; it += 1) {
    const f = pos.map(() => [0, 0]);
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
      const dx = pos[i][0] - pos[j][0] || 0.01; const dy = pos[i][1] - pos[j][1] || 0.01;
      const d2 = dx * dx + dy * dy; if (d2 > k * k * 16) continue;
      const m = (k * k) / d2;
      f[i][0] += dx * m; f[i][1] += dy * m; f[j][0] -= dx * m; f[j][1] -= dy * m;
    }
    edges.forEach(([a, b]) => {
      const dx = pos[a][0] - pos[b][0]; const dy = pos[a][1] - pos[b][1]; const d = Math.hypot(dx, dy) || 1;
      const m = (d - k) / d * 0.5;
      f[a][0] -= dx * m; f[a][1] -= dy * m; f[b][0] += dx * m; f[b][1] += dy * m;
    });
    const cool = 4 * (1 - it / 120) + 0.3;
    pos.forEach((p, i) => { const d = Math.hypot(f[i][0], f[i][1]) || 1; const s = Math.min(d, cool * 3) / d; p[0] += f[i][0] * s; p[1] += f[i][1] * s; });
  }
  return pos;
}

/** Color a qubit node by the selected metric. Never confuses missing with failed. */
function metricColor(q, mode) {
  const c = stateColors();
  const sem = getChartSemanticColors();
  if (mode === 'state') return c[q.state] || c.UNKNOWN;

  if (mode === 't1') {
    if (q.t1 == null) return sem.unknown;
    return q.t1 < 50 ? sem.critical : q.t1 < 100 ? sem.warn : sem.healthy;
  }
  if (mode === 't2') {
    if (q.t2 == null) return sem.unknown;
    return q.t2 < 50 ? sem.critical : q.t2 < 100 ? sem.warn : sem.healthy;
  }
  if (mode === 'readout') {
    if (q.readout_error == null) return sem.unknown;
    return q.readout_error > 0.05 ? sem.critical : q.readout_error > 0.02 ? sem.warn : sem.healthy;
  }
  if (mode === 'freq') {
    if (q.frequency == null) return sem.unknown;
    // 4–6 GHz is typical; outside that range → warn
    const ghz = q.frequency / 1e9;
    return ghz < 3.5 || ghz > 7 ? sem.warn : sem.accent;
  }
  if (mode === 'cal_age') {
    if (q.cal_age_hours == null) return sem.unknown;
    return q.cal_age_hours > 24 ? sem.critical : q.cal_age_hours > 12 ? sem.warn : sem.healthy;
  }
  return c.UNKNOWN;
}

/** Freshness badge */
function FreshnessBadge({ asOf, staleMinutes = 60 }) {
  if (!asOf) return <span className="topo-fresh topo-fresh--missing">No timestamp</span>;
  const ageMin = (Date.now() - new Date(asOf.endsWith('Z') ? asOf : `${asOf}Z`).getTime()) / 60000;
  const isStale = ageMin > staleMinutes;
  return (
    <span className={`topo-fresh ${isStale ? 'topo-fresh--stale' : 'topo-fresh--ok'}`}>
      {ageMin < 1 ? 'just now' : ageMin < 90 ? `${Math.round(ageMin)} min ago` : `${Math.round(ageMin / 60)} h ago`}
    </span>
  );
}

/** Qubit history mini-chart */
function QubitHistoryChart({ history, metric, isDark }) {
  const th = getChartTheme(isDark);
  const sem = getChartSemanticColors();

  const option = useMemo(() => {
    if (!history?.length) return null;
    const metricKey = metric === 't1' ? 't1_us' : metric === 't2' ? 't2_us' : 'readout_error';
    const pts = history.filter((h) => h[metricKey] != null);
    if (!pts.length) return null;

    return {
      animation: false,
      grid: { left: 48, right: 12, top: 10, bottom: 36 },
      tooltip: {
        ...baseTooltip(isDark),
        trigger: 'axis',
        formatter: (params) => {
          const p = params[0];
          return `${p.axisValue}<br/>${p.seriesName}: ${fmt(p.value, 3)}`;
        },
      },
      xAxis: {
        type: 'category',
        data: pts.map((h) => h.collected_at ? formatISTTime(h.collected_at).slice(0, 16) : '—'),
        axisLabel: { color: th.textColor, fontSize: 9, interval: 'auto', rotate: 25 },
        axisLine: { lineStyle: { color: th.axisLine } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: th.textColor, fontSize: 9 },
        splitLine: { lineStyle: { color: th.splitColor } },
      },
      series: [{
        name: metric.toUpperCase(),
        type: 'line',
        data: pts.map((h) => h[metricKey]),
        smooth: true,
        showSymbol: pts.length < 20,
        lineStyle: { color: sem.accent, width: 2 },
        itemStyle: { color: sem.accent },
        areaStyle: { color: `${sem.accent}22` },
      }],
    };
  }, [history, metric, th, isDark, sem]);

  if (!option) return <p className="topo-hist-empty">No historical data for {metric.toUpperCase()}.</p>;
  return <QtECharts option={option} style={{ height: 160 }} notMerge />;
}

/** Calibration comparison panel */
function CalibrationCompare({ snapshots, selectedIds, onSelectIds }) {
  if (!snapshots?.length) return <p className="page-hint">No calibration history available.</p>;

  const [a, b] = selectedIds;
  const snapA = snapshots.find((s) => s.id === a);
  const snapB = snapshots.find((s) => s.id === b);

  const METRICS = ['t1_us', 't2_us', 'readout_error', 'gate_error_1q', 'gate_error_2q'];
  const LABELS = { t1_us: 'T1 (µs)', t2_us: 'T2 (µs)', readout_error: 'Readout error', gate_error_1q: '1Q gate error', gate_error_2q: '2Q gate error' };

  return (
    <div className="topo-compare">
      <div className="topo-compare__selects">
        <label className="topo-compare__label">
          Snapshot A
          <select className="input-control" value={a || ''} onChange={(e) => onSelectIds([e.target.value, b])} aria-label="Calibration snapshot A">
            <option value="">— select —</option>
            {snapshots.map((s) => <option key={s.id} value={s.id}>{s.calibrated_at ? formatISTTime(s.calibrated_at) : s.id}</option>)}
          </select>
        </label>
        <label className="topo-compare__label">
          Snapshot B
          <select className="input-control" value={b || ''} onChange={(e) => onSelectIds([a, e.target.value])} aria-label="Calibration snapshot B">
            <option value="">— select —</option>
            {snapshots.map((s) => <option key={s.id} value={s.id}>{s.calibrated_at ? formatISTTime(s.calibrated_at) : s.id}</option>)}
          </select>
        </label>
      </div>
      {snapA && snapB ? (
        <table className="custom-table custom-table--dense topo-compare__table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Snapshot A</th>
              <th>Snapshot B</th>
              <th>Δ</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => {
              const va = snapA[m]; const vb = snapB[m];
              const delta = va != null && vb != null ? vb - va : null;
              const pct = delta != null && va !== 0 ? (delta / Math.abs(va)) * 100 : null;
              const tone = delta == null ? '' : Math.abs(delta) > 0.01 * (va || 1) ? 'topo-delta--sig' : '';
              return (
                <tr key={m}>
                  <td>{LABELS[m]}</td>
                  <td className="font-mono text-right">{fmt(va, 4)}</td>
                  <td className="font-mono text-right">{fmt(vb, 4)}</td>
                  <td className={`font-mono text-right ${tone}`}>
                    {delta == null ? '—' : `${delta >= 0 ? '+' : ''}${fmt(delta, 4)}${pct != null ? ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)` : ''}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="page-hint" style={{ marginTop: 10 }}>Select two snapshots to compare their metrics.</p>
      )}
    </div>
  );
}

/** Qubit detail drawer */
function QubitDetailDrawer({ open, qubit, backendId, neighbors, onClose, onSelectNeighbor }) {
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const [histMetric, setHistMetric] = useState('t1');
  const [history, setHistory] = useState(null);
  const [histState, setHistState] = useState('idle');
  const [calSnapshots, setCalSnapshots] = useState(null);
  const [compareIds, setCompareIds] = useState([null, null]);
  const [activeTab, setActiveTab] = useState('metrics');

  useEffect(() => {
    if (!open || !qubit || !backendId) return;
    setHistory(null);
    setHistState('loading');
    api.getQubitHistory(backendId, qubit.qubit_index)
      .then((h) => { setHistory(h?.history || []); setHistState('ready'); })
      .catch(() => setHistState('error'));
    api.getCalibrationHistory(backendId)
      .then((r) => setCalSnapshots(r?.history || []))
      .catch(() => setCalSnapshots(null));
  }, [open, qubit?.qubit_index, backendId]);

  if (!qubit) return null;

  const TABS = [
    { key: 'metrics', label: 'Metrics' },
    { key: 'history', label: 'History' },
    { key: 'compare', label: 'Compare' },
  ];

  return (
    <DetailDrawer
      open={open}
      title={`Qubit ${qubit.qubit_index}`}
      subtitle={`${qubit.state} · ${qubit.status || 'No status'}`}
      onClose={onClose}
      size="xl"
    >
      <div className="topo-drawer">
        {/* Tab navigation */}
        <nav className="topo-drawer__tabs" role="tablist" aria-label="Qubit detail tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={activeTab === t.key}
              className={`topo-drawer__tab${activeTab === t.key ? ' topo-drawer__tab--active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {activeTab === 'metrics' && (
          <div role="tabpanel">
            <div className="topo-drawer__section">
              <h4 className="topo-drawer__sect-title">Coherence</h4>
              <dl className="topo-metric-grid">
                <div className="topo-metric-row">
                  <dt>T1</dt><dd>{fmtUs(qubit.t1)}</dd>
                </div>
                <div className="topo-metric-row">
                  <dt>T2</dt><dd>{fmtUs(qubit.t2)}</dd>
                </div>
                <div className="topo-metric-row">
                  <dt>Frequency</dt>
                  <dd>{qubit.frequency != null ? `${(qubit.frequency / 1e9).toFixed(4)} GHz` : '—'}</dd>
                </div>
              </dl>
            </div>

            <div className="topo-drawer__section">
              <h4 className="topo-drawer__sect-title">Fidelity</h4>
              <dl className="topo-metric-grid">
                <div className="topo-metric-row">
                  <dt>Readout error</dt><dd>{fmt(qubit.readout_error, 5)}</dd>
                </div>
                <div className="topo-metric-row">
                  <dt>1Q fidelity (F_1q)</dt><dd>{fmt(qubit.F_1q, 5)}</dd>
                </div>
                <div className="topo-metric-row">
                  <dt>2Q fidelity (F_2q)</dt><dd>{fmt(qubit.F_2q, 5)}</dd>
                </div>
              </dl>
            </div>

            <div className="topo-drawer__section">
              <h4 className="topo-drawer__sect-title">Status</h4>
              <dl className="topo-metric-grid">
                <div className="topo-metric-row">
                  <dt>Health state</dt>
                  <dd>
                    <span className={`badge ${qubit.state === 'GREEN' ? 'badge-healthy' : qubit.state === 'YELLOW' ? 'badge-warning' : qubit.state === 'RED' ? 'badge-critical' : 'badge-info'}`}>
                      {qubit.state}
                    </span>
                  </dd>
                </div>
                <div className="topo-metric-row">
                  <dt>Operational status</dt><dd>{qubit.status || '—'}</dd>
                </div>
              </dl>
              {qubit.action && (
                <p className="topo-drawer__hint">
                  <Info size={12} /> {qubit.action}
                </p>
              )}
              {qubit.reasons?.length > 0 && (
                <ul className="topo-drawer__reasons">
                  {qubit.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
              )}
            </div>

            {neighbors?.length > 0 && (
              <div className="topo-drawer__section">
                <h4 className="topo-drawer__sect-title">Couplings ({neighbors.length})</h4>
                <div className="topo-nbrs">
                  {neighbors.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      className="topo-nbr"
                      onClick={() => onSelectNeighbor(x.id)}
                      title={`Gate error: ${fmt(x.err, 5)}`}
                    >
                      Q{x.qubit_index ?? x.id}
                      {x.err != null && <span className="topo-nbr__err" title="Gate error">{fmt(x.err, 4)}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="topo-drawer__actions">
              <Link
                className="btn btn-primary"
                to={buildBackendDetailsPath(backendId, 'qubits')}
              >
                Open qubit workspace
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div role="tabpanel" className="topo-drawer__section">
            <div className="topo-drawer__metric-pick">
              <label htmlFor="hist-metric-sel" className="page-hint">Metric</label>
              <select
                id="hist-metric-sel"
                className="input-control"
                value={histMetric}
                onChange={(e) => setHistMetric(e.target.value)}
              >
                <option value="t1">T1</option>
                <option value="t2">T2</option>
                <option value="readout">Readout error</option>
              </select>
            </div>
            {histState === 'loading' && <BoneyardSkeleton layout="list" />}
            {histState === 'error' && <p className="page-hint">Could not load qubit history.</p>}
            {histState === 'ready' && (
              <QubitHistoryChart history={history} metric={histMetric} isDark={isDark} />
            )}
            <p className="page-hint" style={{ marginTop: 8 }}>
              History from actual collector executions. Gaps indicate no measurement was recorded.
            </p>
          </div>
        )}

        {activeTab === 'compare' && (
          <div role="tabpanel" className="topo-drawer__section">
            <p className="page-hint">Compare two calibration snapshots for this backend.</p>
            <CalibrationCompare
              snapshots={calSnapshots}
              selectedIds={compareIds}
              onSelectIds={setCompareIds}
            />
          </div>
        )}
      </div>
    </DetailDrawer>
  );
}

export const TopologyExplorer = () => {
  const [params] = useSearchParams();
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const [backends, setBackends] = useState([]);
  const [backendId, setBackendId] = useState('');
  const [graph, setGraph] = useState(null);
  const [vector, setVector] = useState(null);
  const [colorMode, setColorMode] = useState('state');
  const [selectedId, setSelectedId] = useState(params.get('qubit') ? String(params.get('qubit')) : null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('graph'); // graph | table
  const [loadState, setLoadState] = useState('loading');
  const [lastRefresh, setLastRefresh] = useState(null);
  const chartRef = useRef(null);
  const { setActions, clearActions } = usePageActions();

  useEffect(() => {
    api.getBackends().then((b) => {
      setBackends(b || []);
      if (b?.length) setBackendId(b.find((x) => x.backend_id === params.get('backend'))?.backend_id || b[0].backend_id);
      else setLoadState('empty');
    }).catch(() => setLoadState('error'));
  }, []);

  const load = useCallback(() => {
    if (!backendId) return;
    setLoadState('loading');
    Promise.all([
      api.getBackendTopology(backendId),
      api.getHealthVector().catch(() => null),
    ])
      .then(([g, v]) => {
        setGraph(g);
        setVector(v);
        setSelectedId(null);
        setDrawerOpen(false);
        setLastRefresh(new Date());
        setLoadState(g?.nodes?.length ? 'ready' : 'empty');
      })
      .catch(() => setLoadState('error'));
  }, [backendId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh topology" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  // Merge topology nodes with health-vector per-qubit state
  const qubits = useMemo(() => {
    if (!graph?.nodes) return [];
    const hv = vector?.backends?.find((b) => b.backend_id === backendId)?.qubits || [];
    const byIdx = new Map(hv.map((q) => [q.qubit_index, q]));
    return graph.nodes.map((n) => {
      const h = byIdx.get(n.qubit_index);
      return {
        id: n.id, qubit_index: n.qubit_index, status: n.status,
        t1: h?.t1 ?? n.t1_us, t2: h?.t2 ?? n.t2_us,
        readout_error: h?.readout_error ?? n.readout_error,
        frequency: n.frequency,
        cal_age_hours: n.calibration_age_hours ?? null,
        state: h?.state || LEGACY[n.health_status] || 'UNKNOWN',
        reasons: h?.reasons || [], action: h?.action,
        F_2q: h?.F_2q, F_1q: h?.F_1q,
      };
    });
  }, [graph, vector, backendId]);

  // Filter by search term
  const filteredQubits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return qubits;
    return qubits.filter((x) => `q${x.qubit_index}`.includes(q) || String(x.qubit_index).includes(q) || x.state.toLowerCase().includes(q));
  }, [qubits, search]);

  const positions = useMemo(() => (graph ? layoutNodes(graph.nodes, graph.links || []) : []), [graph]);

  const neighbors = useMemo(() => {
    const idxById = new Map(qubits.map((q) => [String(q.id), q.qubit_index]));
    const m = new Map();
    (graph?.links || []).forEach((l) => {
      const s = String(l.source);
      const t = String(l.target);
      const pick = (id) => ({ id, qubit_index: idxById.get(id), err: l.gate_error });
      m.set(s, [...(m.get(s) || []), pick(t)]);
      m.set(t, [...(m.get(t) || []), pick(s)]);
    });
    return m;
  }, [graph, qubits]);

  const selectedQubit = qubits.find((q) => q.id === selectedId);
  const big = qubits.length > 40;

  const option = useMemo(() => {
    if (!qubits.length) return null;
    const th = getChartTheme(isDark);
    const data = qubits.map((q, i) => ({
      id: q.id, name: `Q${q.qubit_index}`, x: positions[i]?.[0] ?? 0, y: positions[i]?.[1] ?? 0, q,
      symbol: STATE_SYMBOL[q.state] || 'circle',
      symbolSize: q.id === selectedId ? 32 : big ? 20 : 28,
      itemStyle: {
        color: metricColor(q, colorMode),
        borderColor: q.id === selectedId ? th.tooltipText : 'transparent',
        borderWidth: q.id === selectedId ? 3 : 0,
      },
    }));
    const links = (graph?.links || []).map((l) => ({
      source: String(l.source), target: String(l.target), gate_error: l.gate_error,
      lineStyle: {
        width: l.gate_error != null ? 1 + Math.min(l.gate_error * 120, 4) : 1.5,
        color: l.gate_error > 0.03 ? stateColors().RED : th.axisLine,
        opacity: 0.9,
      },
    }));
    return {
      animation: false,
      tooltip: {
        ...baseTooltip(isDark),
        trigger: 'item',
        formatter: (p) => {
          if (p.dataType === 'edge') {
            const err = p.data.gate_error;
            const high = err != null && err > 0.03;
            return [
              '<b>Coupling</b>',
              `Q${p.data.source} ↔ Q${p.data.target}`,
              `2Q gate error: ${fmt(err, 4)}${high ? ' · elevated' : ''}`,
              err == null ? '<i>Gate error not supplied by provider</i>' : '',
              'Click a qubit node to inspect it',
            ].filter(Boolean).join('<br/>');
          }
          const q = p.data.q;
          const nbr = (neighbors.get(q.id) || []).length;
          const lines = [
            `<b>Q${q.qubit_index}</b> · ${q.state}`,
            `T1 ${fmtUs(q.t1)} · T2 ${fmtUs(q.t2)}`,
            `Readout error: ${fmt(q.readout_error, 5)}`,
          ];
          if (q.F_1q != null) lines.push(`1Q fidelity: ${fmt(q.F_1q, 4)}`);
          if (q.F_2q != null) lines.push(`2Q fidelity: ${fmt(q.F_2q, 4)}`);
          if (q.action) lines.push(`<i>${q.action}</i>`);
          if (q.reasons?.length) lines.push(`Note: ${q.reasons[0]}${q.reasons.length > 1 ? ` (+${q.reasons.length - 1} more)` : ''}`);
          lines.push(`${nbr} coupling${nbr === 1 ? '' : 's'} · click to inspect`);
          return lines.join('<br/>');
        },
      },
      series: [{
        type: 'graph', layout: 'none', roam: true, data, links, zoom: 1,
        label: { show: true, position: 'inside', fontSize: big ? 8 : 11, color: getChartInkColor(), formatter: (p) => p.name.slice(1) },
        emphasis: { focus: 'adjacency', lineStyle: { width: 4 } },
        scaleLimit: { min: 0.3, max: 10 },
      }],
    };
  }, [qubits, positions, graph, colorMode, isDark, selectedId, big, neighbors]);

  const fit = () => chartRef.current?.getEchartsInstance().dispatchAction({ type: 'restore' });

  const onEvents = useMemo(() => ({
    click: (p) => {
      if (p.dataType === 'node') {
        setSelectedId(p.data.id);
        setDrawerOpen(true);
      }
    },
  }), []);

  const backendName = backends.find((b) => b.backend_id === backendId)?.backend_name;
  const hvTime = vector ? 'live health vector applied' : 'health vector unavailable — topology fields only';

  if (loadState === 'loading' && !graph?.nodes?.length && backendId) {
    return <BoneyardSkeleton layout="grid" />;
  }

  return (
    <div className="page-stack">
      {/* Toolbar */}
      <div className="card topo-toolbar">
        <select
          className="input-control"
          value={backendId}
          onChange={(e) => setBackendId(e.target.value)}
          aria-label="Select backend"
        >
          {backends.map((b) => <option key={b.backend_id} value={b.backend_id}>{b.backend_name}</option>)}
        </select>

        <select
          className="input-control"
          value={colorMode}
          onChange={(e) => setColorMode(e.target.value)}
          aria-label="Colour by metric"
        >
          {COLOR_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        {/* Search */}
        <div className="topo-search" role="search">
          <Search size={13} className="topo-search__icon" aria-hidden />
          <input
            className="input-control topo-search__input"
            placeholder="Search qubit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search qubit by index or state"
          />
          {search && (
            <button type="button" className="topo-search__clear" onClick={() => setSearch('')} aria-label="Clear search">
              <X size={12} />
            </button>
          )}
        </div>

        {/* View mode toggle */}
        <div className="topo-view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={`btn btn-secondary topo-view-btn${viewMode === 'graph' ? ' topo-view-btn--active' : ''}`}
            onClick={() => setViewMode('graph')}
            aria-pressed={viewMode === 'graph'}
          >
            Graph
          </button>
          <button
            type="button"
            className={`btn btn-secondary topo-view-btn${viewMode === 'table' ? ' topo-view-btn--active' : ''}`}
            onClick={() => setViewMode('table')}
            aria-pressed={viewMode === 'table'}
          >
            Table
          </button>
        </div>

        {graph && (
          <span className="topo-meta" aria-live="polite">
            {graph.qpu_modality} · {graph.topology_type} · {graph.node_count} qubits · {graph.edge_count} couplings
          </span>
        )}
      </div>

      {/* Main workspace */}
      <div className={`topo-workspace${viewMode === 'graph' ? ' topo-workspace--wide' : ''}`}>
        <ChartPanel
          title={`QPU coupling graph${backendName ? ` — ${backendName}` : ''}`}
          titleTo={backendId ? buildBackendDetailsPath(backendId, 'qubits') : '/app/backends/qubits'}
          question="Qubit nodes coloured by selected metric. Shapes indicate health state. Edge width proportional to gate error."
          sourceKind="measured"
          asOf={lastRefresh?.toLocaleTimeString()}
          provenanceDetail={`${hvTime}. Layout is computed (spring model); physical chip coordinates are not provided by this backend's API. Missing metrics shown as grey/unknown — not as failures.`}
          state={loadState === 'ready' ? 'ready' : loadState}
          emptyTitle="No topology"
          emptyMessage="This backend reports no qubits or couplings. This may indicate the collector has not completed a discovery run."
          errorMessage={unableToLoad('backend topology')}
          onRetry={load}
          minHeight={560}
          tableAlternative={(
            <div className="topo-table-wrap">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Qubit</th><th>State</th><th>T1</th><th>T2</th>
                    <th>Readout error</th><th>1Q fidelity</th><th>2Q fidelity</th><th>Couplings</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredQubits.length ? filteredQubits : qubits).map((q) => (
                    <tr
                      key={q.id}
                      className={q.id === selectedId ? 'topo-row-sel' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setSelectedId(q.id); setDrawerOpen(true); }}
                    >
                      <td>
                        <button type="button" className="topo-nbr" aria-label={`Inspect qubit ${q.qubit_index}`}>Q{q.qubit_index}</button>
                      </td>
                      <td>
                        <span className={`badge ${q.state === 'GREEN' ? 'badge-healthy' : q.state === 'YELLOW' ? 'badge-warning' : q.state === 'RED' ? 'badge-critical' : 'badge-info'}`}>
                          {q.state}
                        </span>
                      </td>
                      <td className="font-mono text-right">{fmtUs(q.t1)}</td>
                      <td className="font-mono text-right">{fmtUs(q.t2)}</td>
                      <td className="font-mono text-right">{fmt(q.readout_error, 5)}</td>
                      <td className="font-mono text-right">{fmt(q.F_1q, 4)}</td>
                      <td className="font-mono text-right">{fmt(q.F_2q, 4)}</td>
                      <td>{(neighbors.get(q.id) || []).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredQubits.length === 0 && search && (
                <EmptyState variant="inline" compact title="No qubits match" message={`No results for "${search}"`} />
              )}
            </div>
          )}
        >
          {viewMode === 'graph' && (
            <div className="topo-canvas">
              <button type="button" className="btn btn-secondary topo-fit" onClick={fit} aria-label="Fit topology to view">
                <Maximize2 size={14} /> Fit to view
              </button>
              {option && (
                <QtECharts
                  ref={chartRef}
                  option={option}
                  onEvents={onEvents}
                  notMerge
                  style={{ height: '100%', width: '100%' }}
                />
              )}
            </div>
          )}

          {/* Legend */}
          <div className="topo-legend" role="note" aria-label="Colour legend">
            {colorMode === 'state' ? (
              <>
                <span><i className="topo-swatch" style={{ background: stateColors().GREEN }} aria-hidden /> Green ● healthy</span>
                <span><i className="topo-swatch topo-swatch--rot" style={{ background: stateColors().YELLOW }} aria-hidden /> Yellow ◆ attention</span>
                <span><i className="topo-swatch" style={{ background: stateColors().RED }} aria-hidden /> Red ▲ degraded</span>
                <span><i className="topo-swatch" style={{ background: stateColors().UNKNOWN }} aria-hidden /> Grey ■ unknown (not failed)</span>
              </>
            ) : colorMode === 't1' || colorMode === 't2' ? (
              <span>Green ≥100 µs · Amber 50–100 µs · Red &lt;50 µs · Grey = no measurement (not failed)</span>
            ) : colorMode === 'readout' ? (
              <span>Green ≤2% · Amber 2–5% · Red &gt;5% · Grey = no measurement (not failed)</span>
            ) : colorMode === 'freq' ? (
              <span>Cyan = within normal range (3.5–7 GHz) · Amber = outside range · Grey = no measurement</span>
            ) : (
              <span>Green = fresh (&lt;12 h) · Amber = aging (12–24 h) · Red = stale (&gt;24 h) · Grey = no timestamp</span>
            )}
            <span>Edge width ∝ gate error · Red edge &gt;3%</span>
            <span>Scroll to zoom · drag to pan · layout synthetic (no physical coordinates)</span>
          </div>
        </ChartPanel>
      </div>

      {/* Qubit detail drawer */}
      <QubitDetailDrawer
        open={drawerOpen}
        qubit={selectedQubit}
        backendId={backendId}
        neighbors={neighbors.get(selectedId) || []}
        onClose={() => setDrawerOpen(false)}
        onSelectNeighbor={(id) => setSelectedId(id)}
      />
    </div>
  );
};
