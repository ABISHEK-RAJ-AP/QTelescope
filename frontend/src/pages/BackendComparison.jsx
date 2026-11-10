import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildBackendDetailsPath } from '../lib/investigationLinks.js';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { AlertTriangle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { getChartTheme, baseTooltip, getFleetStateChartColors, getModalityChartPalette } from '../components/observability/chartTheme.js';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { useProviderLineage, LineageBadge } from './useLineage.jsx';
import './BackendComparison.css';

const chartPalette = () => getModalityChartPalette();
const stateColors = () => getFleetStateChartColors();

// qubit: per-qubit distribution from compare.qubits[key]; sensitive = value scale differs by modality (never plot together).
const DIST_METRICS = [
  { id: 't1', label: 'T1', unit: 'µs', key: 't1', sensitive: true, log: true, positive: true },
  { id: 't2', label: 'T2', unit: 'µs', key: 't2', sensitive: true, log: true, positive: true },
  { id: 'ro', label: 'Readout error', unit: '', key: 'readout_error' },
  { id: 'fl', label: 'F_limit', unit: '', key: 'F_limit', sensitive: true },
  { id: 'eta', label: 'η_cal', unit: '', key: 'eta_cal', sensitive: true, log: true, positive: true },
  { id: 'cx', label: 'C_exec', unit: '', key: 'C_exec' },
];

const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
const fmt = (v) => {
  if (v == null) return null;
  const a = Math.abs(v);
  if (a >= 1e5) return v.toExponential(2);
  if (a >= 100) return v.toFixed(0);
  if (a >= 1) return v.toFixed(2);
  return v.toFixed(4);
};

function stats(values) {
  const v = values.slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const q = (p) => {
    const i = (v.length - 1) * p;
    const lo = Math.floor(i);
    return v[lo] + (v[Math.ceil(i)] - v[lo]) * (i - lo);
  };
  return { n: v.length, min: v[0], q1: q(0.25), med: q(0.5), q3: q(0.75), max: v[v.length - 1] };
}

function distStats(b, m) {
  const vals = (b.qubits || []).map((q) => num(q[m.key])).filter((x) => x != null && (!m.positive || x > 0));
  return stats(vals);
}

const axisBase = (t) => ({ axisLabel: { color: t.textColor }, nameTextStyle: { color: t.textColor }, axisLine: { lineStyle: { color: t.axisLine } }, splitLine: { lineStyle: { color: t.splitColor } } });

function BoxChart({ rows, metric, dark }) {
  const t = getChartTheme(dark);
  const option = useMemo(() => ({
    grid: { left: 56, right: 12, top: 12, bottom: 40 },
    tooltip: {
      ...baseTooltip(dark),
      trigger: 'item',
      formatter: (p) => {
        const r = rows[p.dataIndex];
        return `${r.name}<br/>min ${fmt(r.s.min)} · median ${fmt(r.s.med)} · max ${fmt(r.s.max)}<br/>${r.s.n} qubits`;
      },
    },
    xAxis: { type: 'category', data: rows.map((r) => r.short), ...axisBase(t), axisLabel: { color: t.textColor, interval: 0 } },
    yAxis: { type: metric.log ? 'log' : 'value', name: metric.unit, ...axisBase(t), scale: !metric.log },
    series: [{
      type: 'boxplot',
      data: rows.map((r) => ({ value: [r.s.min, r.s.q1, r.s.med, r.s.q3, r.s.max], itemStyle: { color: 'transparent', borderColor: r.color, borderWidth: 2 } })),
    }],
  }), [rows, metric, dark, t]);
  return <QtECharts option={option} style={{ height: 320, width: '100%' }} notMerge />;
}

function BarChart({ rows, dark, stacked, unit }) {
  const t = getChartTheme(dark);
  const option = useMemo(() => ({
    grid: { left: 48, right: 12, top: stacked ? 28 : 12, bottom: 40 },
    tooltip: baseTooltip(dark),
    legend: stacked ? { top: 0, textStyle: { color: t.textColor }, data: rows.series.map((s) => s.name) } : undefined,
    xAxis: { type: 'category', data: rows.names, ...axisBase(t), axisLabel: { color: t.textColor, interval: 0 } },
    yAxis: { type: 'value', name: unit, ...axisBase(t) },
    series: rows.series.map((s) => ({ ...s, type: 'bar', barMaxWidth: 36, stack: stacked ? 'x' : undefined })),
  }), [rows, dark, stacked, unit, t]);
  return <QtECharts option={option} style={{ height: 320, width: '100%' }} notMerge />;
}

function RangeCell({ s, sensitive, mixed }) {
  if (!s) return <span className="bc-missing">missing</span>;
  return (
    <span className="bc-range">
      <b>{fmt(s.med)}</b>
      <small>{fmt(s.min)} – {fmt(s.max)}</small>
      {sensitive && mixed && <span className="bc-warnmark" title="Value scale differs by modality">⚠ modality-specific</span>}
    </span>
  );
}

export const BackendComparison = () => {
  const navigate = useNavigate();
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const lineage = useProviderLineage();
  const [params, setParams] = useSearchParams();
  const [backends, setBackends] = useState(null);
  const [queues, setQueues] = useState({});
  const [selected, setSelected] = useState(() => {
    const raw = params.get('backends') || params.get('backend');
    return raw ? raw.split(',').filter(Boolean).slice(0, 4) : null;
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [tick, setTick] = useState(0);
  const { setActions, clearActions } = usePageActions();

  useEffect(() => {
    api.getBackends().then((r) => setBackends(r || [])).catch((e) => { setError(String(e.message || e)); setBackends([]); });
    api.getQueues().then((r) => setQueues(Object.fromEntries((r || []).map((q) => [q.backend_id, q])))).catch(() => {});
  }, [tick]);

  // preselect two eligible: first modality with >=2 backends, live provider first
  useEffect(() => {
    if (!backends || selected || !lineage) return;
    const byMod = {};
    backends.forEach((b) => { (byMod[b.qpu_modality || 'unknown'] ||= []).push(b); });
    const pool = Object.values(byMod).filter((l) => l.length >= 2)
      .sort((a, b) => b.filter((x) => lineage[x.provider_id] === 'live').length - a.filter((x) => lineage[x.provider_id] === 'live').length)[0];
    setSelected(pool ? pool.slice().sort((a, b) => (lineage[b.provider_id] === 'live') - (lineage[a.provider_id] === 'live')).slice(0, 2).map((b) => b.backend_id) : []);
  }, [backends, lineage, selected]);

  const sel = selected || [];
  const key = sel.join('|');

  useEffect(() => {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (key) n.set('backends', key.split('|').join(','));
      else n.delete('backends');
      return n;
    }, { replace: true });
  }, [key, setParams]);

  useEffect(() => {
    if (sel.length < 2) { setResult(null); return undefined; }
    let live = true;
    setBusy(true);
    setError(null);
    api.compareBackends(sel)
      .then((r) => { if (live) { setResult(r); setLastRefresh(new Date()); } })
      .catch((e) => { if (live) setError(String(e.message || e)); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback(() => setTick((x) => x + 1), []);
  useEffect(() => {
    setActions(<RefreshButton onClick={reload} lastRefreshAt={lastRefresh} label="Refresh comparison" />);
    return () => clearActions();
  }, [reload, lastRefresh, setActions, clearActions]);

  const meta = useMemo(() => Object.fromEntries((backends || []).map((b) => [b.backend_id, b])), [backends]);
  const toggle = (id) => setSelected((prev) => {
    const p = prev || [];
    if (p.includes(id)) return p.filter((x) => x !== id);
    return p.length >= 4 ? p : [...p, id];
  });

  const selMods = [...new Set(sel.map((id) => meta[id]?.qpu_modality || 'unknown'))];
  const mixed = selMods.length > 1;
  const selMod = selMods.length === 1 ? selMods[0] : null;

  const rows = useMemo(() => (result?.backends || []).map((b, i) => ({
    ...b, name: b.backend_name || b.backend_id, short: (b.backend_name || b.backend_id).replace(/\s*\(.*\)/, ''), color: chartPalette()[i % chartPalette().length], idx: i,
  })), [result]);

  const queueRows = useMemo(() => rows.map((b) => ({ b, pending: num(queues[b.backend_id]?.pending_jobs) })), [rows, queues]);

  const vectorRows = useMemo(() => {
    const keys = [
      { k: 'F_limit', label: 'F_limit' },
      { k: 'eta_cal', label: 'η_cal' },
      { k: 'C_exec', label: 'C_exec' },
      { k: 'delta_cal', label: 'δ_cal' },
    ];
    return keys.map(({ k, label }) => ({
      key: k,
      label,
      names: rows.map((r) => r.short),
      series: [{
        name: label,
        data: rows.map((r) => {
          const v = num(r.vector?.[k]);
          return v == null ? null : { value: v, itemStyle: { color: r.color } };
        }),
      }],
    }));
  }, [rows]);

  if (!backends) return <BoneyardSkeleton layout="grid" />;
  if (!backends.length) {
    return <div className="page-stack">{error ? <ErrorState variant="panel" message={error} onRetry={reload} /> : <EmptyState variant="panel" title="No backends" message="Register QPUs in Administration before comparing." />}</div>;
  }

  const distGroups = (m) => {
    if (!m.sensitive) return [{ title: null, list: rows }];
    const mods = [...new Set(rows.map((r) => r.qpu_modality))];
    return mods.map((mod) => ({ title: mods.length > 1 ? mod : null, list: rows.filter((r) => r.qpu_modality === mod) }));
  };

  const stateSeries = {
    names: rows.map((r) => r.short),
    series: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'].map((s) => ({ name: s, data: rows.map((r) => num(r.counts?.[s])), itemStyle: { color: stateColors()[s] }, label: { show: false } })),
  };
  const queueData = queueRows.filter((q) => q.pending != null);

  return (
    <div className="page-stack">
      <section className="card page-panel">
        <div className="bc-head">
          <strong>Select 2–4 backends</strong>
          <span className="page-hint">{sel.length}/4 selected · ranks and deltas only apply within one modality</span>
        </div>
        <div className="bc-chips" role="group" aria-label="Backends to compare">
          {backends.map((b) => {
            const on = sel.includes(b.backend_id);
            const mod = b.qpu_modality || 'unknown';
            const mismatch = !on && selMod && mod !== selMod;
            const full = !on && sel.length >= 4;
            return (
              <button key={b.backend_id} type="button" className="bc-chip" aria-pressed={on} disabled={full}
                data-mismatch={mismatch || undefined} onClick={() => toggle(b.backend_id)}>
                <span className="bc-chip__body">
                  <span className="bc-chip__name">{b.backend_name || b.backend_id}</span>
                  <span className="bc-chip__meta">{mod.replace('_', ' ')} · {b.qubit_count ?? '?'}Q</span>
                  <LineageBadge lineage={lineage?.[b.provider_id]} />
                  {mismatch && <span className="bc-chip__warn">different modality</span>}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {mixed && (
        <div className="bc-banner" role="status">
          <AlertTriangle size={16} aria-hidden />
          <span>
            <b>Mixed modalities ({selMods.join(', ')}).</b> No ranking or pair deltas. T1, T2 and η_cal are plotted per modality on separate axes: trapped-ion T1 is millions of µs, superconducting is tens to hundreds. Pick backends of one modality for an ordered comparison.
          </span>
        </div>
      )}
      {sel.length < 2 && <EmptyState variant="panel" compact title="Pick at least two backends" message="Comparison runs automatically once two are selected." />}
      {error && sel.length >= 2 && <ErrorState variant="panel" message={error} onRetry={reload} />}
      {busy && !result && sel.length >= 2 && <BoneyardSkeleton layout="grid" />}

      {result && rows.length > 0 && (
        <>
          <div className="bc-legend" aria-label="Backend colours">
            {rows.map((r) => <span key={r.backend_id}><i style={{ borderColor: r.color }} />{r.name} <LineageBadge lineage={lineage?.[meta[r.backend_id]?.provider_id]} /></span>)}
            {busy && <span className="page-hint">updating…</span>}
          </div>

          <section className="bc-grid">
            {DIST_METRICS.map((m) => distGroups(m).map((g) => {
              const plotted = g.list.map((r) => ({ ...r, s: distStats(r, m) })).filter((r) => r.s);
              const missing = g.list.filter((r) => !plotted.includes(r) && !plotted.some((p) => p.backend_id === r.backend_id));
              return (
                <ChartPanel key={`${m.id}-${g.title}`} title={`${m.label}${m.unit ? ` (${m.unit})` : ''}${g.title ? ` · ${g.title}` : ''}`}
                  question="Per-qubit distribution: box = Q1–Q3, line = median, whiskers = min/max."
                  sourceKind="derived" minHeight={320} state={plotted.length ? 'ready' : 'empty'}
                  emptyTitle="No measurements" emptyMessage="No per-qubit values for these backends."
                  tableAlternative={(
                    <table className="custom-table custom-table--dense"><thead><tr><th>Backend</th><th>Min</th><th>Median</th><th>Max</th><th>n</th></tr></thead>
                      <tbody>{g.list.map((r) => { const s = distStats(r, m); return <tr key={r.backend_id}><td>{r.name}</td><td>{fmt(s?.min) ?? 'missing'}</td><td>{fmt(s?.med) ?? 'missing'}</td><td>{fmt(s?.max) ?? 'missing'}</td><td>{s?.n ?? 0}</td></tr>; })}</tbody></table>
                  )}>
                  <BoxChart rows={plotted} metric={m} dark={dark} />
                  {missing.length > 0 && <p className="page-hint bc-note">No series (gap, not zero): {missing.map((r) => r.short).join(', ')}</p>}
                </ChartPanel>
              );
            }))}

            {vectorRows.map((vr) => (
              <ChartPanel key={vr.label} title={`Vector · ${vr.label}`} question="Backend-level mean from health vector (not cross-modality rank)." sourceKind="derived" minHeight={320}
                state={vr.series[0].data.some((d) => d?.value != null) ? 'ready' : 'empty'}
                emptyTitle="No measurements" emptyMessage="Health vector field not reported for these backends."
                tableAlternative={(
                  <table className="custom-table custom-table--dense"><thead><tr><th>Backend</th><th>{vr.label}</th></tr></thead>
                    <tbody>{rows.map((r) => <tr key={r.backend_id}><td>{r.name}</td><td>{fmt(num(r.vector?.[vr.key])) ?? 'missing'}</td></tr>)}</tbody></table>
                )}>
                <BarChart rows={vr} dark={dark} unit="" />
              </ChartPanel>
            ))}

            <ChartPanel title="Qubits by health state" titleTo="/app/resources/health" question="Count per router state (advisory)." sourceKind="derived" minHeight={320}
              state={rows.some((r) => r.counts) ? 'ready' : 'empty'}
              tableAlternative={(
                <table className="custom-table custom-table--dense"><thead><tr><th>Backend</th><th>Green</th><th>Yellow</th><th>Red</th><th>Unknown</th></tr></thead>
                  <tbody>{rows.map((r) => <tr key={r.backend_id}><td>{r.name}</td>{['GREEN', 'YELLOW', 'RED', 'UNKNOWN'].map((s) => <td key={s}>{r.counts?.[s] ?? 'missing'}</td>)}</tr>)}</tbody></table>
              )}>
              <BarChart rows={stateSeries} dark={dark} stacked unit="qubits" />
              <p className="page-hint bc-note">Counts use modality-specific rules; compare within one modality only.</p>
            </ChartPanel>

            <ChartPanel title="Queue depth" titleTo="/app/execution/queues" question="Pending jobs now." sourceKind="cached" minHeight={320}
              state={queueData.length ? 'ready' : 'empty'} emptyTitle="No measurements" emptyMessage="No queue snapshot for selected backends."
              tableAlternative={(
                <table className="custom-table custom-table--dense"><thead><tr><th>Backend</th><th>Pending jobs</th></tr></thead>
                  <tbody>{queueRows.map(({ b, pending }) => <tr key={b.backend_id}><td>{b.name}</td><td>{pending ?? 'missing'}</td></tr>)}</tbody></table>
              )}>
              <BarChart rows={{ names: queueData.map((q) => q.b.short), series: [{ name: 'Pending', data: queueData.map((q) => ({ value: q.pending, itemStyle: { color: q.b.color } })) }] }} dark={dark} unit="jobs" />
              {queueData.length < queueRows.length && <p className="page-hint bc-note">No data: {queueRows.filter((q) => q.pending == null).map((q) => q.b.short).join(', ')}</p>}
            </ChartPanel>
          </section>

          <section className="card page-panel">
            <h3 className="page-section-title">Comparison table (median, min – max)</h3>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="custom-table custom-table--dense">
                <thead>
                  <tr>
                    <th>Backend</th><th>Modality</th><th>Router</th>
                    {DIST_METRICS.map((m) => <th key={m.id}>{m.label}{m.unit ? ` (${m.unit})` : ''}</th>)}
                    <th>Queue</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.backend_id}
                      className="bc-row-click"
                      tabIndex={0}
                      role="link"
                      onClick={() => navigate(buildBackendDetailsPath(r.backend_id))}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate(buildBackendDetailsPath(r.backend_id)); }}
                    >
                      <td><span className="bc-dot" style={{ borderColor: r.color }} aria-hidden /> {r.name}</td>
                      <td>{(r.qpu_modality || 'unknown').replace('_', ' ')}</td>
                      <td><span className={`badge badge-${r.router === 'GREEN' ? 'healthy' : r.router === 'YELLOW' ? 'warning' : r.router === 'RED' ? 'critical' : 'info'}`}>{r.router}</span></td>
                      {DIST_METRICS.map((m) => <td key={m.id}><RangeCell s={distStats(r, m)} sensitive={m.sensitive} mixed={mixed} /></td>)}
                      <td>{num(queues[r.backend_id]?.pending_jobs) ?? <span className="bc-missing">missing</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card page-panel">
            <h3 className="page-section-title">Pair deltas (A − B)</h3>
            {result.pairs?.some((p) => p.ranking_allowed) ? (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="custom-table custom-table--dense">
                  <thead><tr><th>Pair</th><th>Δ F_limit</th><th>Δ T1 (µs)</th><th>Δ T2 (µs)</th></tr></thead>
                  <tbody>
                    {result.pairs.map((p) => (
                      <tr key={`${p.backend_a}-${p.backend_b}`}>
                        <td>{meta[p.backend_a]?.backend_name || p.backend_a} vs {meta[p.backend_b]?.backend_name || p.backend_b}</td>
                        {p.ranking_allowed
                          ? ['F_limit', 't1_mean_us', 't2_mean_us'].map((k) => <td key={k}>{fmt(num(p.delta?.[k])) ?? <span className="bc-missing">missing</span>}</td>)
                          : <td colSpan={3}><span className="bc-missing">not comparable (different modality)</span></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="page-hint">No same-modality pair in this selection, so no deltas are shown.</p>}
            <p className="page-hint bc-note">{result.methodology}</p>
          </section>
        </>
      )}
    </div>
  );
};
