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
import { isSimulatorBackend } from './fleetData.js';
import { ScopeBanner } from '../components/ds/ScopeBanner.jsx';
import { InfoTooltip } from '../components/observability/InfoTooltip.jsx';
import './BackendComparison.css';

const MAX_COMPARE = 4;
const MIN_COMPARE = 2;
const ROUTER_RANK = { GREEN: 4, YELLOW: 3, UNKNOWN: 2, RED: 1 };

function shortBackendName(name, id) {
  return (name || id).replace(/\s*\(.*\)/, '');
}

function pickRoutingRecommendation(rows, meta, queues) {
  const eligible = rows.filter((r) => !isSimulatorBackend(meta[r.backend_id]));
  if (!eligible.length) return null;
  const scored = eligible.map((r) => {
    const pending = num(queues[r.backend_id]?.pending_jobs);
    const fLim = num(r.vector?.F_limit);
    return {
      id: r.backend_id,
      name: r.name,
      router: r.router || 'UNKNOWN',
      pending,
      fLim,
      score: [
        ROUTER_RANK[r.router] ?? 2,
        pending != null ? -pending : -9999,
        fLim ?? -1,
      ],
    };
  });
  scored.sort((a, b) => {
    for (let i = 0; i < a.score.length; i += 1) {
      if (a.score[i] !== b.score[i]) return b.score[i] - a.score[i];
    }
    return a.name.localeCompare(b.name);
  });
  return scored[0];
}

const chartPalette = () => getModalityChartPalette();
const stateColors = () => getFleetStateChartColors();

// qubit: per-qubit distribution from compare.qubits[key]; sensitive = value scale differs by modality (never plot together).
const DIST_METRICS = [
  { id: 't1', label: 'T1', unit: 'µs', key: 't1', sensitive: true, log: true, positive: true },
  { id: 't2', label: 'T2', unit: 'µs', key: 't2', sensitive: true, log: true, positive: true },
  { id: 'ro', label: 'Readout error', unit: '', key: 'readout_error', positive: true, rate: true },
  { id: 'fl', label: 'F_limit', unit: '', key: 'F_limit', sensitive: true },
  { id: 'eta', label: 'η_cal', unit: 'ratio', key: 'eta_cal', sensitive: true, log: true, positive: true, dimensionless: true },
  { id: 'cx', label: 'C_exec', unit: 'probability', key: 'C_exec', dimensionless: true },
];

const VECTOR_CHARTS = [
  {
    id: 'vfl',
    label: 'Coherence infidelity (1 − F_limit)',
    vectorKey: 'F_limit',
    transform: (v) => (v == null ? null : 1 - v),
    yMax: 0.0025,
    tableFmt: (v) => (v == null ? null : (1 - v).toExponential(3)),
  },
  {
    id: 'veta',
    label: 'η_cal',
    vectorKey: 'eta_cal',
    log: true,
    splitModality: true,
    unit: 'ratio (dimensionless)',
  },
  {
    id: 'vcx',
    label: 'C_exec',
    vectorKey: 'C_exec',
    unit: 'probability [0, 1]',
    tableFmt: (v) => (v == null ? null : v.toFixed(4)),
  },
  {
    id: 'vd',
    label: 'δ_cal',
    vectorKey: 'delta_cal',
    unit: 'σ from baseline',
  },
];

const num = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
const fmt = (v, metric) => {
  if (v == null) return null;
  if (metric?.rate) {
    const pct = v * 100;
    if (pct >= 10) return `${pct.toFixed(2)}%`;
    if (pct >= 1) return `${pct.toFixed(3)}%`;
    return `${pct.toFixed(4)}%`;
  }
  const key = metric?.key || metric?.id;
  if (key === 'F_limit' || key === 'fl') return v.toFixed(6);
  if (key === 'C_exec' || key === 'cx') return v.toFixed(4);
  if (key === 'eta_cal' || key === 'eta') {
    const a = Math.abs(v);
    if (a >= 100) return v.toFixed(1);
    return v.toFixed(4);
  }
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
        return `${r.name}<br/>min ${fmt(r.s.min, metric)} · median ${fmt(r.s.med, metric)} · max ${fmt(r.s.max, metric)}<br/>${r.s.n} qubits`;
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

function BarChart({ rows, dark, stacked, unit, log, yMin, yMax }) {
  const t = getChartTheme(dark);
  const option = useMemo(() => ({
    grid: { left: 48, right: 12, top: stacked ? 28 : 12, bottom: 40 },
    tooltip: baseTooltip(dark),
    legend: stacked ? { top: 0, textStyle: { color: t.textColor }, data: rows.series.map((s) => s.name) } : undefined,
    xAxis: { type: 'category', data: rows.names, ...axisBase(t), axisLabel: { color: t.textColor, interval: 0 } },
    yAxis: {
      type: log ? 'log' : 'value',
      name: unit,
      min: yMin,
      max: yMax,
      ...axisBase(t),
      scale: !log,
    },
    series: rows.series.map((s) => ({ ...s, type: 'bar', barMaxWidth: 36, stack: stacked ? 'x' : undefined })),
  }), [rows, dark, stacked, unit, log, yMin, yMax, t]);
  return <QtECharts option={option} style={{ height: 320, width: '100%' }} notMerge />;
}

function RangeCell({ s, metric, mixed }) {
  if (!s) return <span className="bc-missing">missing</span>;
  return (
    <span className="bc-range">
      <b>{fmt(s.med, metric)}</b>
      <small>{fmt(s.min, metric)} – {fmt(s.max, metric)}</small>
      {metric?.sensitive && mixed && <span className="bc-warnmark" title="Value scale differs by modality">⚠ modality-specific</span>}
    </span>
  );
}

export const BackendComparison = () => {
  const navigate = useNavigate();
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const [params, setParams] = useSearchParams();
  const [backends, setBackends] = useState(null);
  const [queues, setQueues] = useState({});
  const [selected, setSelected] = useState(() => {
    const raw = params.get('backends');
    if (!raw) return [];
    return raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_COMPARE);
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

  useEffect(() => {
    if (!backends?.length) return;
    const valid = new Set(backends.map((b) => b.backend_id));
    setSelected((prev) => {
      const next = prev.filter((id) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
    setParams((p) => {
      const staleScope = p.get('backend');
      if (!staleScope || valid.has(staleScope)) return p;
      const n = new URLSearchParams(p);
      n.delete('backend');
      return n;
    }, { replace: true });
  }, [backends, setParams]);

  const sel = selected;
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
    if (sel.length < MIN_COMPARE) { setResult(null); return undefined; }
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
    if (p.length >= MAX_COMPARE) return p;
    return [...p, id];
  });

  const selMods = [...new Set(sel.map((id) => meta[id]?.qpu_modality || 'unknown'))];
  const mixed = selMods.length > 1;
  const selMod = selMods.length === 1 ? selMods[0] : null;

  const rows = useMemo(() => {
    const byId = Object.fromEntries((result?.backends || []).map((b) => [b.backend_id, b]));
    const palette = chartPalette();
    return sel.map((id, i) => {
      const fromApi = byId[id];
      if (fromApi) {
        return {
          ...fromApi,
          name: fromApi.backend_name || id,
          short: shortBackendName(fromApi.backend_name, id),
          color: palette[i % palette.length],
          idx: i,
        };
      }
      const m = meta[id];
      return {
        backend_id: id,
        backend_name: m?.backend_name || id,
        name: m?.backend_name || id,
        short: shortBackendName(m?.backend_name, id),
        qpu_modality: m?.qpu_modality || 'unknown',
        router: 'UNKNOWN',
        vector: {},
        counts: {},
        qubits: [],
        color: palette[i % palette.length],
        idx: i,
        missing_compare_data: true,
      };
    });
  }, [result, sel, meta]);

  const queueRows = useMemo(() => rows.map((b) => ({ b, pending: num(queues[b.backend_id]?.pending_jobs) })), [rows, queues]);

  const vectorChartGroups = useMemo(() => VECTOR_CHARTS.flatMap((spec) => {
    const split = spec.splitModality && selMods.length > 1;
    const groups = split
      ? selMods.map((mod) => ({ title: mod, list: rows.filter((r) => r.qpu_modality === mod) }))
      : [{ title: null, list: rows }];
    return groups.map((g) => ({
      spec,
      title: g.title,
      chartRows: {
        names: g.list.map((r) => r.short),
        series: [{
          name: spec.label,
          data: g.list.map((r) => {
            const raw = num(r.vector?.[spec.vectorKey]);
            const v = spec.transform ? spec.transform(raw) : raw;
            return v == null ? null : { value: v, itemStyle: { color: r.color } };
          }),
        }],
      },
      list: g.list,
    }));
  }), [rows, selMods]);

  const routingPick = useMemo(
    () => (result && rows.length && !mixed ? pickRoutingRecommendation(rows, meta, queues) : null),
    [result, rows, mixed, meta, queues],
  );

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
          <strong>Select {MIN_COMPARE}–{MAX_COMPARE} backends</strong>
          <span className="page-hint">
            {sel.length}/{MAX_COMPARE} selected
            {sel.length >= MIN_COMPARE ? ` · ${sel.length} in view` : ''}
            {mixed ? ' · mixed modality' : selMod ? ' · ranked within modality' : ''}
          </span>
        </div>
        <div className="bc-chips" role="group" aria-label="Backends to compare">
          {backends.map((b) => {
            const on = sel.includes(b.backend_id);
            const mod = b.qpu_modality || 'unknown';
            const mismatch = !on && selMod && mod !== selMod;
            const full = !on && sel.length >= MAX_COMPARE;
            return (
              <button key={b.backend_id} type="button" className="bc-chip" aria-pressed={on} disabled={full}
                data-mismatch={mismatch || undefined} onClick={() => toggle(b.backend_id)}>
                <span className="bc-chip__body">
                  <span className="bc-chip__name">{b.backend_name || b.backend_id}</span>
                  <span className="bc-chip__meta">{mod.replace('_', ' ')} · {b.qubit_count ?? '?'} qubits</span>
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
          <span>Side-by-side only — pick one modality to rank backends and show pair deltas.</span>
        </div>
      )}
      {sel.length < MIN_COMPARE && (
        <EmptyState
          variant="panel"
          compact
          title={`Pick at least ${MIN_COMPARE} backends`}
          message={`Charts, table, and pair deltas include every selected backend (up to ${MAX_COMPARE}).`}
        />
      )}
      {error && sel.length >= MIN_COMPARE && <ErrorState variant="panel" message={error} onRetry={reload} />}
      {busy && !result && sel.length >= MIN_COMPARE && <BoneyardSkeleton layout="grid" />}

      {result && rows.length > 0 && (
        <>
          {routingPick ? (
            <ScopeBanner
              title="Routing recommendation"
              variant={routingPick.router === 'RED' ? 'critical' : routingPick.router === 'YELLOW' ? 'warn' : 'info'}
              items={[{
                term: routingPick.name,
                detail: `${routingPick.router} routing · ${routingPick.pending != null ? `${routingPick.pending} pending jobs` : 'queue unknown'}${routingPick.fLim != null ? ` · F_limit ${fmt(routingPick.fLim)}` : ''}`,
              }]}
              action={(
                <button type="button" className="btn btn-secondary" onClick={() => navigate(buildBackendDetailsPath(routingPick.id, 'queues'))}>
                  Open queue tab
                </button>
              )}
            />
          ) : mixed ? (
            <p className="page-hint">Pick one modality to get a routing recommendation.</p>
          ) : null}
          <div className="bc-legend" aria-label="Backend colours">
            {rows.map((r) => (
              <span key={r.backend_id}>
                <i style={{ borderColor: r.color }} />
                {r.name}
                {r.data_source_label ? ` · ${r.data_source_label}` : ''}
                {r.missing_compare_data ? ' (no health data)' : ''}
              </span>
            ))}
            {rows.some((r) => r.metric_gaps?.length) && (
              <span className="page-hint">
                Feed gaps: {rows.filter((r) => r.metric_gaps?.length).map((r) => `${r.short}: ${r.metric_gaps.join('; ')}`).join(' · ')}
              </span>
            )}
            {rows.length !== sel.length && (
              <span className="page-hint">Selection mismatch — refresh or re-pick backends.</span>
            )}
            {busy && <span className="page-hint">updating…</span>}
          </div>

          <section className="bc-grid">
            {DIST_METRICS.map((m) => distGroups(m).map((g) => {
              const plotted = g.list.map((r) => ({ ...r, s: distStats(r, m) })).filter((r) => r.s);
              const missing = g.list.filter((r) => !plotted.includes(r) && !plotted.some((p) => p.backend_id === r.backend_id));
              return (
                <ChartPanel key={`${m.id}-${g.title}`} title={`${m.label}${m.unit ? ` (${m.unit})` : ''}${g.title ? ` · ${g.title}` : ''}`}
                  question={m.rate
                    ? 'Per-qubit measurement assignment error (probability 0–100%). Box = Q1–Q3, line = median, whiskers = min/max.'
                    : 'Per-qubit distribution: box = Q1–Q3, line = median, whiskers = min/max.'}
                  sourceKind="derived" minHeight={320} state={plotted.length ? 'ready' : 'empty'}
                  emptyTitle="No measurements" emptyMessage="No per-qubit values for these backends."
                  tableAlternative={(
                    <table className="custom-table custom-table--dense"><thead><tr><th>Backend</th><th>Min</th><th>Median</th><th>Max</th><th>n</th></tr></thead>
                      <tbody>{g.list.map((r) => { const s = distStats(r, m); return <tr key={r.backend_id}><td>{r.name}</td><td>{fmt(s?.min, m) ?? 'missing'}</td><td>{fmt(s?.med, m) ?? 'missing'}</td><td>{fmt(s?.max, m) ?? 'missing'}</td><td>{s?.n ?? 0}</td></tr>; })}</tbody></table>
                  )}>
                  <BoxChart rows={plotted} metric={m} dark={dark} />
                  {missing.length > 0 && <p className="page-hint bc-note">No series (gap, not zero): {missing.map((r) => r.short).join(', ')}</p>}
                </ChartPanel>
              );
            }))}

            {vectorChartGroups.map((vg) => (
              <ChartPanel
                key={`${vg.spec.id}-${vg.title || 'all'}`}
                title={`Vector · ${vg.spec.label}${vg.title ? ` · ${vg.title}` : ''}`}
                question={
                  vg.spec.splitModality
                    ? 'Backend-level mean η_cal — plot per modality only; do not rank trapped-ion vs superconducting.'
                    : vg.spec.id === 'vfl'
                      ? 'Mean 1 − F_limit so small coherence gaps are visible (not cross-modality rank).'
                      : 'Backend-level mean from health vector (dimensionless; not cross-modality rank).'
                }
                sourceKind="derived"
                minHeight={320}
                state={vg.chartRows.series[0].data.some((d) => d?.value != null) ? 'ready' : 'empty'}
                emptyTitle="No measurements"
                emptyMessage="Health vector field not reported for these backends."
                tableAlternative={(
                  <table className="custom-table custom-table--dense"><thead><tr><th>Backend</th><th>{vg.spec.label}</th></tr></thead>
                    <tbody>{vg.list.map((r) => {
                      const raw = num(r.vector?.[vg.spec.vectorKey]);
                      const display = vg.spec.tableFmt ? vg.spec.tableFmt(raw) : fmt(raw, { key: vg.spec.vectorKey });
                      return <tr key={r.backend_id}><td>{r.name}</td><td>{display ?? 'missing'}</td></tr>;
                    })}</tbody></table>
                )}
              >
                <BarChart
                  rows={vg.chartRows}
                  dark={dark}
                  unit={vg.spec.unit || ''}
                  log={vg.spec.log}
                  yMax={vg.spec.yMax}
                />
              </ChartPanel>
            ))}

            <ChartPanel title="Qubits by health state" titleTo="/app/resources/health" question="Count per router state (advisory)." sourceKind="derived" minHeight={320}
              state={rows.some((r) => r.counts) ? 'ready' : 'empty'}
              tableAlternative={(
                <table className="custom-table custom-table--dense"><thead><tr><th>Backend</th><th>Green</th><th>Yellow</th><th>Red</th><th>Unknown</th></tr></thead>
                  <tbody>{rows.map((r) => <tr key={r.backend_id}><td>{r.name}</td>{['GREEN', 'YELLOW', 'RED', 'UNKNOWN'].map((s) => <td key={s}>{r.counts?.[s] ?? 'missing'}</td>)}</tr>)}</tbody></table>
              )}>
              <BarChart rows={stateSeries} dark={dark} stacked unit="qubits" />
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
                    <th>Backend</th><th>Modality</th><th>Data</th><th>Router</th>
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
                      <td className="bc-lineage">{r.data_source_label || <span className="bc-missing">unknown</span>}</td>
                      <td>
                        <span className={`badge badge-${r.router === 'GREEN' ? 'healthy' : r.router === 'YELLOW' ? 'warning' : r.router === 'RED' ? 'critical' : 'info'}`}>{r.router}</span>
                        {r.router_reason ? <div className="bc-router-reason" title={r.router_reason}>{r.router_reason}</div> : null}
                      </td>
                      {DIST_METRICS.map((m) => <td key={m.id}><RangeCell s={distStats(r, m)} metric={m} mixed={mixed} /></td>)}
                      <td>{num(queues[r.backend_id]?.pending_jobs) ?? <span className="bc-missing">missing</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card page-panel bc-pairs">
            <div className="bc-pairs-head">
              <h3 className="page-section-title">Pair deltas (A − B)</h3>
              <InfoTooltip label="Metrics and router (advisory)">
                <dl className="bc-defs-dl">
                  <dt>F_limit</dt>
                  <dd>Coherence fidelity bound in [0, 1].</dd>
                  <dt>η_cal</dt>
                  <dd>Calibration ratio; compare within one modality.</dd>
                  <dt>Router</dt>
                  <dd>
                    Worst qubit wins. T1/T2 floors from per-backend alert rules.
                    {result.routing_gates ? (
                      <> GREEN: η≤{result.routing_gates.eta_green_max}, C_exec≥{result.routing_gates.c_exec_min}.
                        YELLOW: η&gt;{result.routing_gates.eta_yellow_max}.</>
                    ) : null}
                  </dd>
                </dl>
              </InfoTooltip>
            </div>
            {(() => {
              const comparable = (result.pairs || []).filter((p) => p.ranking_allowed);
              if (!result.pairs?.length) {
                return <p className="bc-pairs-empty">Select at least two backends.</p>;
              }
              if (!comparable.length) {
                return <p className="bc-pairs-empty">No comparable pairs — same modality required for ranked deltas.</p>;
              }
              return (
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="custom-table custom-table--dense">
                    <thead><tr><th>Pair</th><th>Δ F_limit</th><th>Δ T1 (µs)</th><th>Δ T2 (µs)</th></tr></thead>
                    <tbody>
                      {comparable.map((p) => (
                        <tr key={`${p.backend_a}-${p.backend_b}`}>
                          <td>{meta[p.backend_a]?.backend_name || p.backend_a} vs {meta[p.backend_b]?.backend_name || p.backend_b}</td>
                          {['F_limit', 't1_mean_us', 't2_mean_us'].map((k) => (
                            <td key={k}>{fmt(num(p.delta?.[k])) ?? <span className="bc-missing">—</span>}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </section>
        </>
      )}
    </div>
  );
};
