import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { Filter } from 'lucide-react';
import { api } from '../services/api';
import { unableToLoad } from '../constants/messages.js';
import { formatISTTime } from '../utils/time';
import { useTheme } from '../components/ui/ThemeProvider';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { readTelemetryWindowHours, telemetryLimitForHours, writeTelemetryWindowHours } from '../utils/telemetryWindow';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { ContextBar } from '../components/observability/ContextBar.jsx';
import { TableEmpty } from '../components/observability/EmptyState.jsx';
import { useAppScope } from '../hooks/useAppScope.js';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { baseTooltip, getChartTheme, getChartSemanticColors } from '../components/observability/chartTheme.js';
import { buildBackendDetailsPath } from '../lib/investigationLinks.js';
import { fmtMetric, healthLink, timelineLink, modalityOf } from './telemetryPageUtils.js';
import { DataPanelToolbar, SortableTh } from '../components/observability/DataViewToolbar.jsx';
import './DriftAnalysis.css';
import './TelemetryPages.css';

const METRIC_OPTS = [
  { api: 't1', ui: 'T1', label: 'T1 Coherence' },
  { api: 't2', ui: 'T2', label: 'T2 Coherence' },
  { api: 'readout_error', ui: 'READOUT_ERROR', label: 'Readout Error' },
];
const apiMetric = (ui) => METRIC_OPTS.find((m) => m.ui === ui)?.api || 't1';
const uiMetric = (api) => METRIC_OPTS.find((m) => m.api === api)?.ui || 'T1';

const DRIFT_RANK = { CRITICAL_DRIFT: 0, DRIFTING: 1, NORMAL: 2 };
const driftBadge = (s) => (s === 'CRITICAL_DRIFT' ? 'badge-critical' : s === 'DRIFTING' ? 'badge-warning' : 'badge-healthy');

export const DriftAnalysis = () => {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const theme = getChartTheme(isDark);

  const { backend: scopeBackend, hours: windowHours, setBackend, setHours: setScopeHours } = useAppScope({
    defaultHours: readTelemetryWindowHours(),
  });
  const setWindowHours = (h) => {
    writeTelemetryWindowHours(h);
    setScopeHours(h);
  };

  const metricApi = (sp.get('metric') || 't1').toLowerCase();
  const metric = uiMetric(metricApi);
  const qubitIndex = Math.max(0, parseInt(sp.get('qubit') ?? '0', 10) || 0);

  const setMetricUi = (ui) => setSp((p) => { const n = new URLSearchParams(p); n.set('metric', apiMetric(ui)); return n; }, { replace: true });
  const setQubitIndex = (q) => setSp((p) => { const n = new URLSearchParams(p); n.set('qubit', String(q)); return n; }, { replace: true });

  const [backends, setBackends] = useState([]);
  const selectedBackend = scopeBackend;
  const [driftData, setDriftData] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [driftErr, setDriftErr] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [layout, setLayout] = useState('table');
  const [sort, setSort] = useState({ key: 'status', dir: 'asc' });
  const { setActions, clearActions } = usePageActions();

  const loadBackends = useCallback(() => {
    api.getBackends()
      .then((res) => {
        const list = res || [];
        setBackends(list);
        if (!list.length) return;
        const valid = scopeBackend && list.some((b) => b.backend_id === scopeBackend);
        if (!valid) setBackend(list[0].backend_id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [scopeBackend, setBackend]);

  const loadSummaries = useCallback(() => {
    api.getDriftSummaries(metricApi)
      .then((rows) => setSummaries(Array.isArray(rows) ? rows : []))
      .catch(() => setSummaries([]));
  }, [metricApi]);

  const loadDrift = useCallback(() => {
    if (!selectedBackend) return;
    setDriftErr(false);
    const limit = telemetryLimitForHours(windowHours);
    api
      .getDriftAnalysis(selectedBackend, metric, qubitIndex, limit)
      .then((res) => {
        const pts = res?.points || [];
        setDriftData({
          ...res,
          data_points: pts.map((p) => p.current_value),
          rolling_mean: pts.map((p) => p.rolling_avg),
          timestamps: pts.map((p) => p.timestamp),
          delta: res.abs_change,
          percent_change: res.pct_change,
          rate_of_change: pts.length ? pts[pts.length - 1].rate_of_change : null,
          rolling_std: pts.map((p) => p.rolling_std_dev),
        });
        setLastRefresh(new Date());
      })
      .catch(() => { setDriftData(null); setDriftErr(true); });
  }, [selectedBackend, metric, qubitIndex, windowHours]);

  useEffect(() => { loadBackends(); }, [loadBackends]);
  useEffect(() => { loadSummaries(); }, [loadSummaries]);
  useEffect(() => { loadDrift(); }, [loadDrift]);

  useEffect(() => {
    setActions(
      <RefreshButton
        onClick={() => { loadBackends(); loadSummaries(); loadDrift(); }}
        lastRefreshAt={lastRefresh}
        label="Refresh drift analysis"
      />,
    );
    return () => clearActions();
  }, [loadBackends, loadSummaries, loadDrift, lastRefresh, setActions, clearActions]);

  const rankedSummaries = useMemo(() => {
    const list = summaries.filter((r) => !scopeBackend || r.backend_id === scopeBackend).slice();
    const mul = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let c = 0;
      if (sort.key === 'backend') {
        c = String(backends.find((x) => x.backend_id === a.backend_id)?.backend_name || a.backend_id)
          .localeCompare(String(backends.find((x) => x.backend_id === b.backend_id)?.backend_name || b.backend_id));
      } else if (sort.key === 'pct') {
        c = Math.abs(a.pct_change ?? 0) - Math.abs(b.pct_change ?? 0);
      } else {
        c = (DRIFT_RANK[a.drift_status] ?? 9) - (DRIFT_RANK[b.drift_status] ?? 9);
      }
      return c * mul;
    });
    return list;
  }, [summaries, scopeBackend, sort, backends]);

  const mixedModality = useMemo(() => new Set(rankedSummaries.map((r) => modalityOf(backends, r.backend_id)).filter(Boolean)).size > 1, [rankedSummaries, backends]);

  const chartOption = useMemo(() => {
    const sem = getChartSemanticColors();
    const labels = (driftData?.timestamps || []).map((t) => formatISTTime(t, false));
    return {
      backgroundColor: 'transparent',
      tooltip: {
        ...baseTooltip(isDark),
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params];
          if (!list.length) return '';
          const idx = list[0].dataIndex;
          const ts = driftData?.timestamps?.[idx];
          const raw = driftData?.data_points?.[idx];
          const roll = driftData?.rolling_mean?.[idx];
          const head = ts ? formatISTTime(ts, false) : `Sample ${idx + 1}`;
          const lines = [head, ...list.map((p) => `${p.seriesName}: ${p.value != null ? Number(p.value).toFixed(3) : '—'}`)];
          if (raw != null && roll != null && Number.isFinite(Number(raw)) && Number.isFinite(Number(roll)) && roll !== 0) {
            const delta = ((Number(raw) - Number(roll)) / Math.abs(Number(roll))) * 100;
            lines.push(`Δ vs rolling mean: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`);
          }
          return lines.join('<br/>');
        },
      },
      legend: { textStyle: { color: theme.textColor } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: labels.length ? labels : driftData?.data_points?.map((_, idx) => `Point ${idx + 1}`) || [],
        axisLine: { lineStyle: { color: theme.axisLine } },
        axisLabel: { color: theme.textColor, rotate: labels.length > 8 ? 30 : 0 },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { lineStyle: { color: theme.axisLine } },
        splitLine: { lineStyle: { color: theme.splitColor } },
        axisLabel: { color: theme.textColor },
      },
      series: [
        { name: 'Raw telemetry', type: 'line', smooth: true, data: driftData?.data_points || [], itemStyle: { color: sem.accent } },
        { name: 'Rolling mean', type: 'line', smooth: true, lineStyle: { type: 'dashed' }, data: driftData?.rolling_mean || [], itemStyle: { color: sem.info } },
      ],
    };
  }, [driftData, isDark, theme]);

  if (loading) return <BoneyardSkeleton layout="grid" />;
  if (!backends.length) {
    return (
      <div className="page-stack">
        <EmptyState variant="panel" title="No backends" message="Add backends under Configure before running drift analysis." />
      </div>
    );
  }

  const hasSeries = driftData?.data_points?.length > 0;
  const mod = modalityOf(backends, selectedBackend);

  return (
    <div className="page-stack">
      <ContextBar
        backend={selectedBackend}
        backends={backends}
        onBackendChange={setBackend}
        hours={windowHours}
        onHoursChange={setWindowHours}
        showTimeRange
        timeRangeAffectsQuery
      />
      <div className="card page-panel drift-controls-bar">
        <div className="drift-filter-group page-filter-row">
          <Filter size={16} color="#64748b" aria-hidden />
          <select value={metric} onChange={(e) => setMetricUi(e.target.value)} className="input-control" aria-label="Metric">
            {METRIC_OPTS.map((m) => <option key={m.ui} value={m.ui}>{m.label}</option>)}
          </select>
          <input
            type="number"
            min="0"
            max="126"
            value={qubitIndex}
            onChange={(e) => setQubitIndex(parseInt(e.target.value, 10) || 0)}
            className="input-control"
            style={{ width: 110 }}
            placeholder="Qubit #"
            aria-label="Qubit index"
          />
        </div>
      </div>

      {mixedModality && (
        <p className="tm-callout">Fleet table spans modalities — compare absolute {metricApi} only within the same modality row (trapped-ion T1 is millions of µs).</p>
      )}

      <section className="card page-panel dvt-panel" aria-label="Fleet drift summary">
        <h3 className="dvt-panel__title">Fleet drift (Q0 summary per backend)</h3>
        <p className="page-hint" style={{ margin: '0 16px 8px' }}>Summary lists one representative qubit per backend. Select a row to load the full series.</p>
        <DataPanelToolbar layout={layout} onLayoutChange={setLayout} countLabel={`${rankedSummaries.length} backend${rankedSummaries.length === 1 ? '' : 's'}`} />
        {layout === 'grid' ? (
          <div className="dvt-grid">
            {rankedSummaries.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '8px 14px' }}><TableEmpty colSpan={1} title="No drift summaries" message="Change metric or wait for additional stored samples." /></div>
            ) : rankedSummaries.map((r) => (
              <article key={r.backend_id} className="dvt-card" data-active={r.backend_id === selectedBackend || undefined}>
                <header className="dvt-card__head">
                  <div>
                    <button type="button" className="tm-rowbtn dvt-card__title" onClick={() => { setBackend(r.backend_id); setQubitIndex(r.qubit_index ?? 0); }}>
                      {backends.find((b) => b.backend_id === r.backend_id)?.backend_name || r.backend_id}
                    </button>
                    <p className="dvt-card__meta">{modalityOf(backends, r.backend_id) || '—'} · Q{r.qubit_index ?? 0}</p>
                  </div>
                  <span className={`badge ${driftBadge(r.drift_status)}`}>{r.drift_status || '—'}</span>
                </header>
                <dl className="dvt-card__stats">
                  <div><dt>Latest</dt><dd>{fmtMetric(r.latest_val, metricApi)}</dd></div>
                  <div><dt>Δ%</dt><dd>{r.pct_change != null ? `${r.pct_change > 0 ? '+' : ''}${Number(r.pct_change).toFixed(1)}%` : '—'}</dd></div>
                </dl>
                <footer className="dvt-card__foot dvt-actions">
                  <button type="button" className="btn btn-secondary btn--xs" onClick={() => navigate(healthLink(r.backend_id, r.qubit_index ?? 0))}>Health</button>
                  <button type="button" className="btn btn-secondary btn--xs" onClick={() => navigate(buildBackendDetailsPath(r.backend_id))}>Backend</button>
                  <button type="button" className="btn btn-secondary btn--xs" onClick={() => navigate(timelineLink(r.backend_id))}>Timeline</button>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <div className="table-container tm-table-wrap" style={{ border: 'none' }}>
            <table className="custom-table custom-table--dense">
              <thead>
                <tr>
                  <SortableTh sort={sort} sortKey="backend" onToggle={setSort} defaultDir="asc">Backend</SortableTh>
                  <th>Modality</th>
                  <th>Qubit</th>
                  <SortableTh sort={sort} sortKey="status" onToggle={setSort} defaultDir="asc">Status</SortableTh>
                  <th className="tm-num">Latest</th>
                  <SortableTh sort={sort} sortKey="pct" onToggle={setSort} defaultDir="desc" className="tm-num">Δ%</SortableTh>
                  <th>Investigate</th>
                </tr>
              </thead>
              <tbody>
                {rankedSummaries.length === 0 ? (
                  <TableEmpty colSpan={7} title="No drift summaries" message="Change metric or wait for additional stored samples." />
                ) : rankedSummaries.map((r) => (
                  <tr key={r.backend_id} className={r.backend_id === selectedBackend && r.qubit_index === qubitIndex ? 'drift-row--active' : undefined}>
                    <td>
                      <button type="button" className="tm-rowbtn" onClick={() => { setBackend(r.backend_id); setQubitIndex(r.qubit_index ?? 0); }}>
                        {backends.find((b) => b.backend_id === r.backend_id)?.backend_name || r.backend_id}
                      </button>
                    </td>
                    <td>{modalityOf(backends, r.backend_id) || '—'}</td>
                    <td>Q{r.qubit_index ?? 0}</td>
                    <td><span className={`badge ${driftBadge(r.drift_status)}`}>{r.drift_status || '—'}</span></td>
                    <td className="tm-num">{fmtMetric(r.latest_val, metricApi)}</td>
                    <td className="tm-num">{r.pct_change != null ? `${r.pct_change > 0 ? '+' : ''}${Number(r.pct_change).toFixed(1)}%` : '—'}</td>
                    <td>
                      <div className="dvt-actions tm-actions">
                        <button type="button" className="btn btn-secondary btn--xs" onClick={() => navigate(healthLink(r.backend_id, r.qubit_index ?? 0))}>Health</button>
                        <button type="button" className="btn btn-secondary btn--xs" onClick={() => navigate(buildBackendDetailsPath(r.backend_id))}>Backend</button>
                        <button type="button" className="btn btn-secondary btn--xs" onClick={() => navigate(timelineLink(r.backend_id))}>Timeline</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {driftData && (
        <div className="drift-stat-grid">
          <div className="drift-stat-box">
            <div className="drift-stat-label">Drift status</div>
            <span className={`badge ${driftBadge(driftData.drift_status)}`} style={{ marginTop: 6 }}>{driftData.drift_status || '—'}</span>
          </div>
          <div className="drift-stat-box">
            <div className="drift-stat-label">Absolute Change (Δ)</div>
            <div className="drift-stat-val-cyan">{driftData.delta?.toFixed(2) ?? '—'}</div>
          </div>
          <div className="drift-stat-box">
            <div className="drift-stat-label">Percent Change (%Δ)</div>
            <div className="drift-stat-val-purple">{driftData.percent_change?.toFixed(2) ?? '—'}%</div>
          </div>
          <div className="drift-stat-box">
            <div className="drift-stat-label">Rate of Change (unit/hr)</div>
            <div className="drift-stat-val-amber">{driftData.rate_of_change?.toFixed(3) ?? '—'}</div>
          </div>
          <div className="drift-stat-box">
            <div className="drift-stat-label">Rolling Std Dev</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
              {driftData.rolling_std?.length > 0 ? driftData.rolling_std[driftData.rolling_std.length - 1]?.toFixed(2) : '—'}
            </div>
          </div>
        </div>
      )}

      {driftErr && <p className="tm-callout tm-callout--bad" role="alert">{unableToLoad('drift series for this backend and qubit')}</p>}

      <ChartPanel
        title={`${metric} drift · Q${qubitIndex}${mod ? ` · ${mod}` : ''}`}
        question="Rolling statistics from stored qubit telemetry."
        sourceKind="cached"
        state={hasSeries ? 'ready' : 'empty'}
        emptyTitle="Insufficient samples"
        emptyMessage="Not enough stored points in the selected lookback window."
        minHeight={380}
        tableAlternative={hasSeries ? undefined : (
          <p className="page-hint">No samples in the selected window (absence of data, not a zero reading).</p>
        )}
      >
        <QtECharts option={chartOption} style={{ height: 'min(420px, 50vh)', minHeight: 320, width: '100%' }} />
      </ChartPanel>
      {selectedBackend && (
        <div className="tm-actions" style={{ marginTop: 4 }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(healthLink(selectedBackend, qubitIndex))}>Qubit health</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/app/telemetry/anomalies?backend=${encodeURIComponent(selectedBackend)}&metric=${metricApi}`)}>Anomalies</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/app/telemetry/compare?backends=${encodeURIComponent(selectedBackend)}`)}>Compare</button>
        </div>
      )}
    </div>
  );
};
