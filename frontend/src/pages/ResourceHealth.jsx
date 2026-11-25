import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { api, peekApiCache } from '../services/api';
import { unableToLoad } from '../constants/messages.js';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { InsightModal } from '../components/observability/InsightModal.jsx';
import { InfoTooltip } from '../components/observability/InfoTooltip.jsx';
import { getChartTheme, baseTooltip, itemTooltip, formatQubitHealthTooltip, getFleetStateChartColors } from '../components/observability/chartTheme.js';
import { ConfirmDialog } from '../components/observability/ConfirmDialog.jsx';
import { buildBackendDetailsPath, buildDriftInvestigationLocation } from '../lib/investigationLinks.js';
import { useAppScope } from '../hooks/useAppScope.js';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { formatBackendTitle, formatModalityLabel } from '../lib/displayLabels.js';
import { STATE_TIER } from './backendUtils.js';
import { mergeScopeSearch } from '../lib/appScopeQuery.js';
import { backendRegistryHoverTitle, TelemetryCoverageCallout } from './backendCommon.jsx';
import './ResourceHealth.css';

const STATES = ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'];
const stateColor = (state) => getFleetStateChartColors()[state] || getFleetStateChartColors().UNKNOWN;
const STATE_MEANING = {
  GREEN: 'Allow routing',
  YELLOW: 'Recalibrate recommended',
  RED: 'Quarantine candidate',
  UNKNOWN: 'Not enough data to score',
};

// higherIsBetter drives the color ramp direction; log for metrics spanning decades.
const COLOR_MODES = {
  state: { label: 'Health state' },
  t1: { label: 'T1 (µs)', key: 't1', higherIsBetter: true, log: true },
  t2: { label: 'T2 (µs)', key: 't2', higherIsBetter: true, log: true },
  readout_error: { label: 'Readout error', key: 'readout_error', higherIsBetter: false },
  eta_cal: { label: 'η_cal', key: 'eta_cal', higherIsBetter: false, log: true },
  C_exec: { label: 'C_exec', key: 'C_exec', higherIsBetter: true },
};

const fmt = (v, d = 3) => {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  return Math.abs(n) >= 1e5 ? n.toExponential(2) : n.toFixed(d);
};
const pct = (n, total) => (total ? (n / total) * 100 : 0);

function rampColor(t) {
  // t in 0..1, 1 = worse. light blue -> deep blue is "better"; flip so worse is darker amber/rose.
  const hue = 200 - 200 * t; // 200 (blue) -> 0 (red)
  return `hsl(${Math.round(hue)} 70% ${Math.round(70 - 20 * t)}%)`;
}

function metricScaler(rows, mode) {
  const vals = rows
    .map((q) => q[mode.key])
    .filter((v) => v != null && Number.isFinite(v) && (!mode.log || v > 0))
    .map((v) => (mode.log ? Math.log10(v) : v))
    .sort((a, b) => a - b);
  if (!vals.length) return () => null;
  const lo = vals[Math.floor(vals.length * 0.05)];
  const hi = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.95))];
  return (raw) => {
    if (raw == null || !Number.isFinite(raw) || (mode.log && raw <= 0)) return null;
    const v = mode.log ? Math.log10(raw) : raw;
    let t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
    t = Math.max(0, Math.min(1, t));
    return mode.higherIsBetter ? 1 - t : t;
  };
}

function StateBar({ counts, total }) {
  return (
    <div className="hv-bar" role="img" aria-label={STATES.map((s) => `${counts?.[s] || 0} ${s}`).join(', ')}>
      {STATES.map((s) => (counts?.[s] ? (
        <span key={s} className={`hv-seg--${s}`} style={{ width: `${pct(counts[s], total)}%` }} />
      ) : null))}
    </div>
  );
}

function QubitDrawerBody({ backend, qubit, explain, history }) {
  const { resolved } = useTheme();
  const t = getChartTheme(resolved === 'dark');
  const hist = useMemo(() => (history || []).toReversed(), [history]);
  const option = useMemo(() => ({
    grid: { left: 48, right: 16, top: 28, bottom: 28 },
    legend: { data: ['T1', 'T2'], textStyle: { color: t.textColor }, top: 0 },
    tooltip: baseTooltip(resolved === 'dark'),
    xAxis: { type: 'category', data: hist.map((h) => new Date(h.timestamp + (h.timestamp.endsWith('Z') ? '' : 'Z')).toLocaleTimeString()), axisLabel: { color: t.textColor }, axisLine: { lineStyle: { color: t.axisLine } } },
    yAxis: { type: 'value', name: 'µs', nameTextStyle: { color: t.textColor }, axisLabel: { color: t.textColor }, splitLine: { lineStyle: { color: t.splitColor } } },
    series: [
      { name: 'T1', type: 'line', showSymbol: false, data: hist.map((h) => h.t1), lineStyle: { width: 2 } },
      { name: 'T2', type: 'line', showSymbol: false, data: hist.map((h) => h.t2), lineStyle: { width: 2 } },
    ],
  }), [hist, resolved, t]);

  const quarantined = qubit.status === 'QUARANTINED';
  return (
    <div className="hv-drawer">
      <div className="hv-drawer-state">
        <span className={`badge badge-${qubit.state === 'GREEN' ? 'healthy' : qubit.state === 'YELLOW' ? 'warning' : qubit.state === 'RED' ? 'critical' : 'info'}`}>{qubit.state}</span>
        <span>{STATE_MEANING[qubit.state]}</span>
        {quarantined && <span className="badge badge-warning">Advisory quarantine</span>}
      </div>
      <p className="page-hint" style={{ margin: 0 }}>
        {(explain?.summary) || (qubit.reasons || []).join(' · ') || 'No scoring rules triggered.'}
      </p>

      <h4>Rule evidence</h4>
      {(explain?.components || []).length === 0 ? (
        <p className="page-hint">Component breakdown unavailable.</p>
      ) : explain.components.map((c) => (
        <div className="hv-comp" key={c.id}>
          <span>{c.label}</span>
          <span><b>{fmt(c.value)}{c.unit ? ` ${c.unit}` : ''}</b> <span className="hv-comp__status" data-s={c.status}>{c.status}</span></span>
          {c.note && <small>{c.note}</small>}
        </div>
      ))}

      <h4>T1 / T2 history ({hist.length} samples)</h4>
      {hist.length < 2 ? (
        <p className="page-hint">Not enough stored samples to draw a trend.</p>
      ) : <QtECharts option={option} style={{ height: 200 }} />}

      <p className="hv-provenance">
        Model {qubit.health_model_version} · confidence {qubit.confidence}
        {qubit.missing_components?.length ? ` · missing ${qubit.missing_components.join(', ')}` : ''}.
        Stored telemetry + calibration snapshot; advisory routing only.
      </p>
    </div>
  );
}

export const ResourceHealth = () => {
  const nav = useNavigate();
  const [params, setSearchParams] = useSearchParams();
  const { backend: backendId } = useAppScope();
  const [focusedBackendId, setFocusedBackendId] = useState('');
  const { resolved } = useTheme();
  const [payload, setPayload] = useState(() => peekApiCache('/health/vector') ?? null);
  const [loadError, setLoadError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDlg, setConfirmDlg] = useState(null);
  const [colorBy, setColorBy] = useState('state');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => {
    const q = params.get('qubit');
    return q != null && q !== '' && Number.isFinite(Number(q)) ? Number(q) : null;
  });
  const [detail, setDetail] = useState({ explain: null, history: null });
  const { setActions, clearActions } = usePageActions();

  useEffect(() => {
    const q = params.get('qubit');
    if (q == null || q === '') {
      setSelected(null);
      return;
    }
    const n = Number(q);
    if (Number.isFinite(n)) setSelected(n);
  }, [params]);

  const selectBackend = (id) => {
    setFocusedBackendId(id);
    setSelected(null);
    setStateFilter('ALL');
    setSearchParams((prev) => {
      const next = mergeScopeSearch(prev, { backend: id });
      next.delete('qubit');
      return next;
    }, { replace: true });
  };

  const selectQubit = (idx) => {
    setSelected(idx);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (idx == null) next.delete('qubit');
      else next.set('qubit', String(idx));
      return next;
    }, { replace: true });
  };

  const load = useCallback(() => {
    setLoadError(null);
    api.getHealthVector()
      .then((r) => { setPayload(r); setLastRefresh(new Date()); })
      .catch(() => setLoadError(unableToLoad('the health vector')));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh health data" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  const backends = payload?.backends;
  const active = useMemo(() => {
    const list = backends || [];
    const prefer = focusedBackendId || backendId;
    if (prefer) {
      const scoped = list.find((b) => b.backend_id === prefer);
      if (scoped) return scoped;
    }
    return list.find((b) => (b.counts?.RED || 0) > 0)
      || list.find((b) => (b.qubits || []).length > 0)
      || list[0];
  }, [backends, backendId, focusedBackendId]);

  useEffect(() => {
    if (!backends?.length) return;
    const ids = new Set(backends.map((b) => b.backend_id));
    const fromFocus = focusedBackendId && ids.has(focusedBackendId) ? focusedBackendId : '';
    const fromUrl = backendId && ids.has(backendId) ? backendId : '';
    const pick = fromFocus || fromUrl
      || backends.find((b) => (b.counts?.RED || 0) > 0)?.backend_id
      || backends.find((b) => (b.qubits || []).length > 0)?.backend_id
      || backends[0]?.backend_id
      || '';
    if (pick && pick !== focusedBackendId) setFocusedBackendId(pick);
  }, [backends, backendId, focusedBackendId]);

  const fleet = useMemo(() => {
    const c = { GREEN: 0, YELLOW: 0, RED: 0, UNKNOWN: 0 };
    (backends || []).forEach((b) => STATES.forEach((s) => { c[s] += b.counts?.[s] || 0; }));
    return { ...c, total: STATES.reduce((a, s) => a + c[s], 0) };
  }, [backends]);

  useEffect(() => {
    if (selected == null || !active) { setDetail({ explain: null, history: null }); return; }
    let live = true;
    setDetail({ explain: null, history: null });
    Promise.all([
      api.getHealthExplainQubit(active.backend_id, selected).catch(() => null),
      api.getQubitHistory(active.backend_id, selected).catch(() => null),
    ]).then(([explain, history]) => { if (live) setDetail({ explain, history }); });
    return () => { live = false; };
  }, [active, selected]);

  const qubits = useMemo(() => active?.qubits || [], [active]);
  const gridCols = useMemo(() => {
    const n = qubits.length;
    if (!n) return 8;
    return Math.min(16, Math.max(4, Math.ceil(Math.sqrt(n))));
  }, [qubits.length]);
  const mode = COLOR_MODES[colorBy];
  const scale = useMemo(() => (mode.key ? metricScaler(qubits, mode) : null), [qubits, mode]);
  const visible = (q) => (stateFilter === 'ALL' || q.state === stateFilter)
    && (!search.trim() || String(q.qubit_index) === search.trim().replace(/^q/i, ''));

  const scatter = useMemo(() => {
    const th = getChartTheme(resolved === 'dark');
    const pts = (s) => qubits.filter((q) => q.state === s && q.t1 > 0 && q.readout_error != null)
      .map((q) => ({ value: [q.t1, q.readout_error], qubit: q.qubit_index, state: q.state, status: q.status }));
    return {
      grid: { left: 48, right: 12, top: 36, bottom: 36, containLabel: true },
      legend: { data: ['GREEN', 'YELLOW', 'RED'], textStyle: { color: th.textColor }, top: 0 },
      tooltip: itemTooltip(resolved === 'dark', (p) => formatQubitHealthTooltip(
        { qubit_index: p.data.qubit, state: p.data.state, value: p.value },
        [
          p.data.status ? `Status ${p.data.status}` : null,
          'Click to inspect',
        ].filter(Boolean),
      )),
      xAxis: { type: 'log', name: 'T1 (µs)', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: th.textColor }, axisLabel: { color: th.textColor }, splitLine: { lineStyle: { color: th.splitColor } } },
      yAxis: { type: 'value', name: 'Readout error', nameTextStyle: { color: th.textColor }, axisLabel: { color: th.textColor }, splitLine: { lineStyle: { color: th.splitColor } } },
      series: ['GREEN', 'YELLOW', 'RED'].map((s) => ({ name: s, type: 'scatter', symbolSize: 9, itemStyle: { color: stateColor(s), opacity: 0.85 }, data: pts(s) })),
    };
  }, [qubits, resolved]);

  const applyRouter = () => {
    const redQ = fleet.RED;
    setConfirmDlg({
      title: `Quarantine ${redQ} RED qubit${redQ === 1 ? '' : 's'}?`,
      body: 'Marks advisory quarantine in this platform DB only. Vendor schedulers and hardware routing are not changed.',
      confirm: 'Apply advisory quarantine',
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        try { await api.applyHealthRouter(); load(); } finally { setBusy(false); setConfirmDlg(null); }
      },
    });
  };

  const toggleQuarantine = () => {
    const q = qubits.find((x) => x.qubit_index === selected);
    if (!q) return;
    const releasing = q.status === 'QUARANTINED';
    if (releasing) {
      setConfirmDlg({
        title: `Release advisory quarantine · Q${q.qubit_index}?`,
        body: `Clears the advisory quarantine for this backend (${active.backend_id}) in the platform database only. Vendor schedulers and hardware routing are unchanged.`,
        confirm: 'Release advisory quarantine',
        onConfirm: async () => {
          setBusy(true);
          try { await api.releaseQubit(active.backend_id, q.qubit_index); load(); selectQubit(q.qubit_index); } finally { setBusy(false); setConfirmDlg(null); }
        },
      });
      return;
    }
    setConfirmDlg({
      title: `Advisory quarantine · Q${q.qubit_index}?`,
      body: `Records an advisory quarantine for this backend (${active.backend_id}) in the platform database only. Vendor schedulers and hardware routing are unchanged.`,
      confirm: 'Apply advisory quarantine',
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        try { await api.quarantineQubit(active.backend_id, q.qubit_index, 'operator advisory'); load(); selectQubit(q.qubit_index); } finally { setBusy(false); setConfirmDlg(null); }
      },
    });
  };

  if (!payload && !loadError) return <BoneyardSkeleton layout="grid" />;
  if (!payload) return <div className="page-stack"><ErrorState variant="panel" message={loadError} onRetry={load} /></div>;
  if (!backends.length) {
    return <EmptyState variant="panel" title="No health vectors" message="Collectors have not written backend health data yet." hint="Open Platform health, then refresh." />;
  }

  const selectedQubit = qubits.find((q) => q.qubit_index === selected);
  const shown = qubits.filter(visible).length;
  const hugeEta = qubits.some((q) => q.eta_cal > 100);

  return (
    <div className="page-stack">
      <section className="hv-summary">
        <div className="card page-panel">
          <div className="hv-kpis">
            <div className="hv-kpi"><div className="hv-kpi__label">Qubits scored</div><div className="hv-kpi__value">{fleet.total}</div><div className="hv-kpi__sub">{backends.length} backends</div></div>
            {['GREEN', 'YELLOW', 'RED'].map((s) => (
              <div key={s} className={`hv-kpi hv-kpi--${s}`}>
                <div className="hv-kpi__label">{s}</div>
                <div className="hv-kpi__value">{fleet[s]}</div>
                <div className="hv-kpi__sub">{STATE_MEANING[s]}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}><StateBar counts={fleet} total={fleet.total} /></div>
          <div className="hv-coverage">
            <TelemetryCoverageCallout unknownCount={fleet.UNKNOWN} totalCount={fleet.total} />
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={applyRouter} disabled={busy || fleet.RED === 0}>
              {busy ? 'Applying…' : `Advisory-quarantine all RED (${fleet.RED})`}
            </button>
            <InfoTooltip label="Advisory actions">Advisory actions apply to routing recommendations for this fleet. Platform DB only — does not change vendor schedulers.</InfoTooltip>
          </div>
        </div>

        <div className="card page-panel hv-backends" style={{ padding: 0 }}>
          {backends.map((b) => {
            const total = STATES.reduce((a, s) => a + (b.counts?.[s] || 0), 0);
            return (
              <button key={b.backend_id} type="button" className="hv-backend" aria-pressed={active?.backend_id === b.backend_id}
                onClick={() => selectBackend(b.backend_id)}>
                <div>
                  <div
                    className="hv-backend__name"
                    title={backendRegistryHoverTitle(formatBackendTitle(b), b.backend_id)}
                  >
                    {formatBackendTitle(b)}
                  </div>
                  <div className="hv-backend__id">{formatModalityLabel(b.qpu_modality)}</div>
                </div>
                <div>
                  {total ? <StateBar counts={b.counts} total={total} /> : <span className="page-hint">No qubits reported</span>}
                  <div className="hv-backend__nums">G {b.counts?.GREEN || 0} · Y {b.counts?.YELLOW || 0} · R {b.counts?.RED || 0}{b.counts?.UNKNOWN ? ` · ? ${b.counts.UNKNOWN}` : ''}</div>
                </div>
                <span className={`badge badge-${b.router === 'GREEN' ? 'healthy' : b.router === 'YELLOW' ? 'warning' : b.router === 'RED' ? 'critical' : 'info'}`} title="Routing advisory">{STATE_TIER[b.router] || b.router}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="hv-workspace">
        <div className="card" style={{ padding: 0 }}>
          <div className="hv-toolbar">
            <div className="hv-toolbar__row hv-toolbar__row--title">
              <div className="hv-toolbar__title">
                <strong
                  className="hv-toolbar__name"
                  title={backendRegistryHoverTitle(formatBackendTitle(active), active.backend_id)}
                >
                  {formatBackendTitle(active)}
                </strong>
                <button type="button" className="hv-toolbar__link fs-link" onClick={() => nav({ pathname: buildBackendDetailsPath(active.backend_id), search: `?backend=${encodeURIComponent(active.backend_id)}` })}>Backend details</button>
              </div>
              <span className="hv-toolbar__count">{shown} / {qubits.length} qubits</span>
            </div>
            <div className="hv-toolbar__row hv-toolbar__row--filters">
              <label className="outline-field hv-toolbar__field">
                <span>Color by</span>
                <select className="input-control" value={colorBy} onChange={(e) => setColorBy(e.target.value)} aria-label="Color by">
                  {Object.entries(COLOR_MODES).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                </select>
              </label>
              <div className="hv-toolbar__states">
                <span className="hv-toolbar__states-label" id="hv-state-filter-label">Health state</span>
                <span className="hv-chips" role="group" aria-labelledby="hv-state-filter-label">
                  {['ALL', ...STATES].map((s) => (
                    <button key={s} type="button" className="hv-chip" aria-pressed={stateFilter === s} onClick={() => setStateFilter(s)}>{s === 'ALL' ? 'All' : STATE_TIER[s] || s}</button>
                  ))}
                </span>
              </div>
              <label className="outline-field hv-toolbar__field hv-toolbar__field--search">
                <span>Qubit index</span>
                <input type="search" className="input-control" placeholder="e.g. 12" aria-label="Find qubit by index" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <InfoTooltip label="Health scoring">
                <div className="hv-model-tip">
                  <p><strong>Vector H</strong> = F_limit, η_cal, δ_cal, C_exec · {payload.health_model_version}</p>
                  <ul>
                    <li>T1 floor: {active?.t1_crit_us ?? '—'} µs (per-backend alert rules){active?.threshold_profile?.modality ? ` · ${active.threshold_profile.modality}` : ''}</li>
                    <li>T2 floor: {active?.t2_crit_us ?? '—'} µs (per-backend alert rules)</li>
                    <li>GREEN: η_cal ≤ {payload?.routing_gates?.eta_green_max ?? 1.2} and C_exec ≥ {payload?.routing_gates?.c_exec_min ?? 0.5}</li>
                    <li>YELLOW: η_cal &gt; {payload?.routing_gates?.eta_yellow_max ?? 1.5} or δ_cal &gt; {payload?.routing_gates?.delta_cal_yellow_min ?? 2}</li>
                    <li>RED: T1 below backend floor, environment CRITICAL, or any qubit RED</li>
                  </ul>
                  <p className="hv-model-tip__note">Advisory readiness — not vendor calibration or scheduler exclusion.</p>
                </div>
              </InfoTooltip>
            </div>
          </div>

          {qubits.length === 0 ? (
            <EmptyState variant="panel" compact title="No qubit telemetry" message="No qubit records for this backend; health score unavailable." />
          ) : (
            <>
              <div
                className="hv-grid"
                role="list"
                aria-label="Qubit health map"
                style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(44px, 1fr))`, maxWidth: `min(100%, ${gridCols * 52}px)` }}
              >
                {qubits.map((q) => {
                  const s = scale ? scale(q[mode.key]) : null;
                  const dim = !visible(q);
                  const style = scale && s != null ? { background: rampColor(s) } : undefined;
                  return (
                    <button
                      key={q.qubit_index}
                      type="button"
                      role="listitem"
                      className={`hv-cell${dim ? ' hv-cell--dim' : ''}`}
                      data-state={scale && s != null ? undefined : q.state}
                      data-mode={scale ? 'metric' : undefined}
                      data-flag={scale ? q.state : undefined}
                      aria-current={selected === q.qubit_index}
                      aria-label={`Qubit ${q.qubit_index}, ${q.state}${mode.key ? `, ${mode.label} ${fmt(q[mode.key])}` : ''}`}
                      title={`Q${q.qubit_index} · ${q.state}${mode.key ? ` · ${mode.label} ${fmt(q[mode.key])}` : ''}`}
                      style={style}
                      onClick={() => selectQubit(q.qubit_index)}
                    >
                      {q.qubit_index}
                    </button>
                  );
                })}
              </div>
              <div className="hv-legend">
                {mode.key ? (
                  <>
                    <span>{mode.higherIsBetter ? 'worse' : 'better'}</span><span className="hv-ramp" /><span>{mode.higherIsBetter ? 'better' : 'worse'}</span>
                    <span>◆ red · ● yellow marker = router state · hatched = no value</span>
                  </>
                ) : STATES.map((s) => <span key={s}><i style={{ background: stateColor(s) }} />{s} · {STATE_MEANING[s]}</span>)}
              </div>
              {hugeEta && <p className="hv-note">η_cal is large here (T1 ≫ gate time, common for trapped ions). Router still uses this backend's alert-rule T1/T2 floors — treat high η_cal as context, not a cross-modality rank.</p>}
              {active.confidence !== 'high' && <p className="hv-note">Scoring confidence is "{active.confidence}": some inputs are missing{qubits.some((q) => q.missing_components?.length) ? ` (${[...new Set(qubits.flatMap((q) => q.missing_components || []))].join(', ')})` : ''}.</p>}
            </>
          )}
        </div>

        <ChartPanel
          title="Coherence vs readout error"
          titleTo={active?.backend_id ? buildDriftInvestigationLocation({ backendId: active.backend_id }) : '/app/telemetry/drift'}
          question="T1 and readout outliers across the selected backend."
          sourceKind="derived"
          state={scatter.series.some((s) => s.data.length) ? 'ready' : 'empty'}
          emptyMessage="No qubits with both T1 and readout error."
          minHeight={320}
          tableAlternative={<p className="page-hint">Use the qubit map; each cell opens the insight panel for that qubit.</p>}
        >
          <QtECharts
            option={scatter}
            style={{ height: 320 }}
            onEvents={{ click: (p) => p?.data?.qubit != null && selectQubit(p.data.qubit) }}
          />
        </ChartPanel>
      </section>

      <InsightModal
        open={selected != null && !!selectedQubit}
        size="xl"
        title={selectedQubit ? `${formatBackendTitle(active)} · Q${selectedQubit.qubit_index}` : ''}
        subtitle={selectedQubit ? STATE_MEANING[selectedQubit.state] : ''}
        onClose={() => selectQubit(null)}
        footer={selectedQubit && (
          <div className="hv-drawer-actions">
            <nav className="link-row" aria-label="Related workspaces">
              <button type="button" className="fs-link" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }} onClick={() => nav(buildBackendDetailsPath(active.backend_id, 'qubits'))}>Backend qubits</button>
              <button type="button" className="fs-link" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }} onClick={() => nav(buildDriftInvestigationLocation({ backendId: active.backend_id }))}>Drift analysis</button>
              <button type="button" className="fs-link" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }} onClick={() => nav(buildBackendDetailsPath(active.backend_id, 'calibration'))}>Calibration</button>
            </nav>
            <button type="button" className="btn btn-primary" onClick={toggleQuarantine}>
              {selectedQubit.status === 'QUARANTINED' ? 'Release advisory quarantine' : 'Advisory quarantine'}
            </button>
          </div>
        )}
      >
        {selectedQubit && (
          <QubitDrawerBody backend={active} qubit={selectedQubit} explain={detail.explain} history={detail.history} />
        )}
      </InsightModal>

      {confirmDlg && (
        <ConfirmDialog
          dlg={confirmDlg}
          busy={busy}
          onCancel={() => !busy && setConfirmDlg(null)}
          onConfirm={confirmDlg.onConfirm}
        />
      )}
    </div>
  );
};
