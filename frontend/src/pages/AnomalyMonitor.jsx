import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { api } from '../services/api';
import { unableToLoad } from '../constants/messages.js';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { TableEmpty } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { DetailDrawer } from '../components/observability/DetailDrawer.jsx';
import {
  DetailModalBody,
  DetailModalSection,
  DetailModalRelated,
  DetailModalCallout,
} from '../components/observability/DetailModalLayout.jsx';
import { PageRelatedLink } from '../components/observability/PageRelatedNav.jsx';
import { ContextBar } from '../components/observability/ContextBar.jsx';
import { getChartTheme, baseTooltip, getChartSemanticColors, getAnomalySeverityChartColors, getChartInkColor } from '../components/observability/chartTheme.js';
import { useAppScope } from '../hooks/useAppScope.js';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { formatISTTime } from '../utils/time';
import { buildBackendDetailsPath, buildDriftInvestigationLocation } from '../lib/investigationLinks.js';
import { METRICS, METRIC_KEYS, normMetric, fmtMetric, fmtNum, isStale, modalityOf, healthLink, timelineLink } from './telemetryPageUtils.js';
import { DataPanelToolbar, SortableTh } from '../components/observability/DataViewToolbar.jsx';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { AnimatedNumber } from '../components/ui/AnimatedNumber.jsx';
import './TelemetryPages.css';

// rank: higher = worse. Letter shown in heatmap cell so status is never color alone.
function anomalySeverityMeta() {
  const c = getAnomalySeverityChartColors();
  return {
    ANOMALY: { rank: 3, letter: 'A', badge: 'badge-critical', color: c.ANOMALY },
    WARNING: { rank: 2, letter: 'W', badge: 'badge-warning', color: c.WARNING },
    CHANGE_POINT: { rank: 1, letter: 'C', badge: 'badge-info', color: c.CHANGE_POINT },
  };
}
const sevOf = (s) => {
  const SEV = anomalySeverityMeta();
  const fallback = getAnomalySeverityChartColors().default;
  return SEV[s] || { rank: 0, letter: '?', badge: 'badge-info', color: fallback };
};
const deviation = (h) => (h.latest_value != null && h.latest_ewma ? ((h.latest_value - h.latest_ewma) / Math.abs(h.latest_ewma)) * 100 : null);

function QubitDrawerBody({ hit, metric, modality, nav }) {
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const th = getChartTheme(isDark);
  const [state, setState] = useState({ loading: true, detail: null, hist: null, err: false });

  useEffect(() => {
    let live = true;
    Promise.all([
      api.getQubitAnomalies(hit.backend_id, hit.qubit_index, metric).catch(() => null),
      api.getQubitHistory(hit.backend_id, hit.qubit_index).catch(() => null),
    ]).then(([detail, hist]) => { if (live) setState({ loading: false, detail, hist, err: !detail && !hist }); });
    return () => { live = false; };
  }, [hit, metric]);

  const series = useMemo(() => [...(state.hist || [])].reverse().filter((h) => h[metric] != null), [state.hist, metric]);
  const cpTs = state.detail?.change_point_timestamp;
  const option = useMemo(() => {
    const sem = getChartSemanticColors();
    const labels = series.map((h) => formatISTTime(h.timestamp, false));
    const marks = [];
    if (cpTs) {
      const l = formatISTTime(cpTs, false);
      marks.push({ xAxis: labels.includes(l) ? l : labels[0], name: 'change point', label: { formatter: 'change point', color: th.textColor }, lineStyle: { color: sem.critical, type: 'dashed' } });
    }
    if (state.detail?.latest_ewma != null) marks.push({ yAxis: state.detail.latest_ewma, name: 'EWMA', label: { formatter: 'EWMA', color: th.textColor }, lineStyle: { color: sem.info, type: 'dotted' } });
    return {
      backgroundColor: 'transparent',
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      tooltip: baseTooltip(isDark),
      xAxis: { type: 'category', data: labels, axisLabel: { color: th.textColor }, axisLine: { lineStyle: { color: th.axisLine } } },
      yAxis: { type: 'value', scale: true, name: METRICS[metric].unit, axisLabel: { color: th.textColor }, splitLine: { lineStyle: { color: th.splitColor } } },
      series: [{
        name: METRICS[metric].label, type: 'line', showSymbol: series.length < 40, data: series.map((h) => h[metric]),
        lineStyle: { width: 2 }, markLine: marks.length ? { symbol: 'none', data: marks } : undefined,
      }],
    };
  }, [series, cpTs, state.detail, metric, isDark, th]);

  const last = series[series.length - 1];
  return (
    <DetailModalBody>
      {modality && modality !== 'superconducting' && (
        <DetailModalCallout>Modality {modality}: values use different scales than superconducting backends. Do not compare across modalities.</DetailModalCallout>
      )}
      {state.err && <ErrorState compact variant="inline" message={unableToLoad('qubit detail')} />}
      {state.detail?.flags?.length > 0 && <p className="page-hint" style={{ margin: 0 }}>Flags: {state.detail.flags.join(', ')}</p>}
      <DetailModalSection title={`${METRICS[metric].label} history (${series.length} stored samples)`}>
        {state.loading ? <p className="page-hint">Loading…</p> : series.length < 2 ? (
          <p className="page-hint">Not enough stored samples for a chart (gap in data, not a zero value).</p>
        ) : (
          <>
            {isStale(last.timestamp) && <DetailModalCallout>Stale: newest sample {formatISTTime(last.timestamp)}.</DetailModalCallout>}
            <QtECharts option={option} style={{ height: 280, width: '100%' }} />
          </>
        )}
        <p className="page-hint" style={{ margin: '10px 0 0' }}>
          Latest {fmtMetric(state.detail?.latest_value ?? hit.latest_value, metric)} · EWMA {fmtMetric(state.detail?.latest_ewma ?? hit.latest_ewma, metric)}
          {cpTs ? ` · change point ${formatISTTime(cpTs)}` : ''}. {state.detail?.methodology}
        </p>
      </DetailModalSection>
      <DetailModalRelated>
        <PageRelatedLink onClick={() => nav(healthLink(hit.backend_id, hit.qubit_index))}>Resource health</PageRelatedLink>
        <PageRelatedLink onClick={() => nav(buildBackendDetailsPath(hit.backend_id, 'qubits'))}>Backend qubits</PageRelatedLink>
        <PageRelatedLink onClick={() => nav(buildDriftInvestigationLocation({ backendId: hit.backend_id }))}>Drift</PageRelatedLink>
        <PageRelatedLink onClick={() => nav(timelineLink(hit.backend_id))}>Timeline</PageRelatedLink>
      </DetailModalRelated>
    </DetailModalBody>
  );
}

export const AnomalyMonitor = () => {
  const navigate = useNavigate();
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const th = getChartTheme(isDark);
  const { backend: scopeBackend, setBackend } = useAppScope();
  const [sp, setSp] = useSearchParams();
  const metric = normMetric(sp.get('metric'));
  const setMetric = (m) => setSp((p) => { const n = new URLSearchParams(p); n.set('metric', m); return n; }, { replace: true });
  const [data, setData] = useState(null);
  const [backends, setBackends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [selected, setSelected] = useState(null);
  const [layout, setLayout] = useState('table');
  const [sort, setSort] = useState({ key: 'status', dir: 'asc' });
  const { setActions, clearActions } = usePageActions();

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([api.getAnomalySummary(metric), api.getBackends().catch(() => [])])
      .then(([d, b]) => { setData(d); setBackends(b || []); setLastRefresh(new Date()); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [metric]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh anomaly scan" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  const hits = useMemo(() => {
    const all = (data?.hits || []).filter((h) => !scopeBackend || h.backend_id === scopeBackend)
      .map((h) => ({ ...h, dev: deviation(h) }));
    const mul = sort.dir === 'asc' ? 1 : -1;
    return all.slice().sort((a, b) => {
      let c = 0;
      if (sort.key === 'backend') {
        c = String(a.backend_name || a.backend_id).localeCompare(String(b.backend_name || b.backend_id));
      } else if (sort.key === 'dev') {
        c = Math.abs(a.dev ?? 0) - Math.abs(b.dev ?? 0);
      } else if (sort.key === 'qubit') {
        c = (a.qubit_index ?? 0) - (b.qubit_index ?? 0);
      } else {
        c = sevOf(a.status).rank - sevOf(b.status).rank;
      }
      return c * mul;
    });
  }, [data, scopeBackend, sort]);

  const count = (s) => hits.filter((h) => h.status === s).length;
  const rows = useMemo(() => (scopeBackend ? backends.filter((b) => b.backend_id === scopeBackend) : backends), [backends, scopeBackend]);
  const mixedModality = useMemo(() => new Set(hits.map((h) => modalityOf(backends, h.backend_id)).filter(Boolean)).size > 1, [hits, backends]);

  const heat = useMemo(() => {
    const cols = [...new Set(hits.map((h) => h.qubit_index))].sort((a, b) => a - b);
    const ys = rows.map((b) => b.backend_name || b.backend_id);
    return {
      cols,
      option: {
        backgroundColor: 'transparent',
        tooltip: {
          ...baseTooltip(isDark),
          trigger: 'item',
          formatter: (p) => {
            const h = hits[p.data[3]];
            if (!h) return '';
            const dev = deviation(h);
            return [
              `<b>${h.backend_name || h.backend_id} · Q${h.qubit_index}</b>`,
              `${h.status} · ${METRICS[metric].label} ${fmtMetric(h.latest_value, metric)}`,
              h.latest_ewma != null ? `EWMA ${fmtMetric(h.latest_ewma, metric)}` : null,
              dev != null ? `Δ vs EWMA ${dev >= 0 ? '+' : ''}${dev.toFixed(1)}%` : null,
              'Click for history',
            ].filter(Boolean).join('<br/>');
          },
        },
        grid: { left: 8, right: 16, top: 16, bottom: 56, containLabel: true },
        xAxis: { type: 'category', data: cols.map((c) => `Q${c}`), splitArea: { show: true }, axisLabel: { color: th.textColor }, axisLine: { lineStyle: { color: th.axisLine } } },
        yAxis: { type: 'category', data: ys, axisLabel: { color: th.textColor, width: 150, overflow: 'truncate' } },
        visualMap: { type: 'piecewise', orient: 'horizontal', left: 'center', bottom: 0, textStyle: { color: th.textColor }, pieces: [
          { value: 1, label: 'C change point', color: sevOf('CHANGE_POINT').color },
          { value: 2, label: 'W warning', color: sevOf('WARNING').color },
          { value: 3, label: 'A anomaly', color: sevOf('ANOMALY').color }], dimension: 2 },
        series: [{
          type: 'heatmap',
          data: hits.map((h, i) => {
            const y = rows.findIndex((b) => b.backend_id === h.backend_id);
            return y < 0 ? null : [cols.indexOf(h.qubit_index), y, sevOf(h.status).rank, i];
          }).filter(Boolean),
          label: { show: true, color: getChartInkColor(), fontWeight: 700, formatter: (p) => ['', 'C', 'W', 'A'][p.data[2]] },
          itemStyle: { borderColor: th.splitColor, borderWidth: 2 },
        }],
      },
    };
  }, [hits, rows, metric, isDark, th]);

  const onHeatClick = (p) => { const h = hits[p.data?.[3]]; if (h) setSelected(h); };
  const modOf = (id) => modalityOf(backends, id);

  if (loading && !data && !error) {
    return (
      <div className="page-stack">
        <ContextBar backend={scopeBackend} backends={backends} onBackendChange={setBackend}>
          <label className="context-bar__field outline-field">
            <span>Metric</span>
            <select className="input-control" value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Metric">
              {METRIC_KEYS.map((k) => <option key={k} value={k}>{METRICS[k].label}{METRICS[k].unit ? ` (${METRICS[k].unit})` : ''}</option>)}
            </select>
          </label>
        </ContextBar>
        <BoneyardSkeleton layout="grid" />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <ContextBar
        backend={scopeBackend}
        backends={backends}
        onBackendChange={setBackend}
      >
        <label className="context-bar__field outline-field">
          <span>Metric</span>
          <select className="input-control" value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Metric">
            {METRIC_KEYS.map((k) => <option key={k} value={k}>{METRICS[k].label}{METRICS[k].unit ? ` (${METRICS[k].unit})` : ''}</option>)}
          </select>
        </label>
      </ContextBar>

      {error && <ErrorState variant="panel" message={unableToLoad('anomaly summary')} onRetry={load} />}
      {!error && (
        <>
          <div className="tm-kpis">
            <div className="tm-kpi"><div className="tm-kpi__label">Series scanned</div><div className="tm-kpi__value">{Number.isFinite(data?.series_scanned) ? <AnimatedNumber value={data.series_scanned} /> : '—'}</div><div className="tm-kpi__sub">{data?.backends_scanned ?? '—'} backends</div></div>
            <div className="tm-kpi"><div className="tm-kpi__label">Anomalies</div><div className="tm-kpi__value" style={{ color: count('ANOMALY') ? 'var(--accent-rose)' : undefined }}><AnimatedNumber value={count('ANOMALY')} /></div><div className="tm-kpi__sub">in view</div></div>
            <div className="tm-kpi"><div className="tm-kpi__label">Warnings</div><div className="tm-kpi__value" style={{ color: count('WARNING') ? 'var(--accent-amber)' : undefined }}><AnimatedNumber value={count('WARNING')} /></div><div className="tm-kpi__sub">in view</div></div>
            <div className="tm-kpi"><div className="tm-kpi__label">Change points</div><div className="tm-kpi__value"><AnimatedNumber value={count('CHANGE_POINT')} /></div><div className="tm-kpi__sub">in view</div></div>
          </div>

          <ChartPanel
            title="Backend × qubit anomaly map"
            titleTo={scopeBackend ? `/app/telemetry/drift?backend=${encodeURIComponent(scopeBackend)}` : '/app/telemetry/drift'}
            question="Flagged qubits from the latest scan — select a cell for the series."
            sourceKind="cached"
            asOf={lastRefresh ? lastRefresh.toLocaleTimeString() : undefined}
            state={loading && !data ? 'loading' : hits.length ? 'ready' : 'empty'}
            emptyTitle="No flags in scan"
            emptyMessage={`${data?.series_scanned ?? 0} series scanned (${data?.insufficient_series ?? 0} too short for EWMA). None exceeded warning thresholds. See the watch list for highest |z| scores.`}
            minHeight={320}
            tableAlternative={<p className="page-hint">{hits.map((h) => `${h.backend_name || h.backend_id} Q${h.qubit_index}: ${h.status}`).join('; ')}</p>}
          >
            <QtECharts option={heat.option} style={{ height: Math.max(320, 120 + rows.length * 48), width: '100%' }} onEvents={{ click: onHeatClick }} />
          </ChartPanel>

          {mixedModality && <p className="tm-callout">Multiple modalities in view. Compare deviation % within one backend row only; absolute T1/T2 scales differ by modality.</p>}

          {!loading && data && hits.length === 0 && (data.watch_list || []).length > 0 && (
            <section className="card page-panel" aria-label="Watch list">
              <h3 className="dvt-panel__title">Watch list (below threshold)</h3>
              <p className="page-hint" style={{ marginTop: 0 }}>Latest sample vs EWMA; |z| under 2.5σ — not promoted to a flag.</p>
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr><th>Backend</th><th>Qubit</th><th>Latest</th><th>EWMA</th><th>|z|</th></tr>
                  </thead>
                  <tbody>
                    {data.watch_list.map((w) => (
                      <tr key={`${w.backend_id}-${w.qubit_index}`}>
                        <td>{w.backend_name || w.backend_id}</td>
                        <td>Q{w.qubit_index}</td>
                        <td>{fmtMetric(w.latest_value, metric)}</td>
                        <td>{fmtMetric(w.latest_ewma, metric)}</td>
                        <td>{w.latest_z != null ? Number(w.latest_z).toFixed(2) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="card page-panel dvt-panel" aria-label="Ranked anomalies">
            <DataPanelToolbar
              title={`Ranked flagged qubits (${hits.length})`}
              layout={layout}
              onLayoutChange={setLayout}
              countLabel={`${hits.length} hit${hits.length === 1 ? '' : 's'}`}
            />
            {layout === 'grid' ? (
              <div className="dvt-grid">
                {hits.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '8px 14px' }}><TableEmpty colSpan={1} title={scopeBackend ? 'No flags for backend' : 'No flagged qubits'} message="Change metric or clear the backend filter." /></div>
                ) : hits.map((h) => (
                  <article key={`${h.backend_id}-${h.qubit_index}`} className="dvt-card">
                    <header className="dvt-card__head">
                      <div>
                        <h4 className="dvt-card__title">{h.backend_name || h.backend_id}</h4>
                        <p className="dvt-card__meta">{modOf(h.backend_id)} · Q{h.qubit_index}</p>
                      </div>
                      <span className={`badge ${sevOf(h.status).badge}`}>{h.status}</span>
                    </header>
                    <dl className="dvt-card__stats">
                      <div><dt>Latest</dt><dd>{fmtMetric(h.latest_value, metric)}</dd></div>
                      <div><dt>Dev %</dt><dd>{h.dev == null ? '—' : `${h.dev > 0 ? '+' : ''}${fmtNum(h.dev, 1)}%`}</dd></div>
                    </dl>
                    <footer className="dvt-card__foot dvt-actions">
                      <button type="button" className="btn btn-primary btn--xs" onClick={() => setSelected(h)}>Open series</button>
                      <button type="button" className="btn btn-secondary btn--xs" onClick={() => navigate(healthLink(h.backend_id, h.qubit_index))}>Workspace</button>
                    </footer>
                  </article>
                ))}
              </div>
            ) : (
              <div className="table-container tm-table-wrap" style={{ border: 'none' }}>
                <table className="custom-table custom-table--dense">
                  <thead>
                    <tr>
                      <th>#</th>
                      <SortableTh sort={sort} sortKey="backend" onToggle={setSort} defaultDir="asc">Backend</SortableTh>
                      <SortableTh sort={sort} sortKey="qubit" onToggle={setSort} defaultDir="asc">Qubit</SortableTh>
                      <SortableTh sort={sort} sortKey="status" onToggle={setSort} defaultDir="asc">Status</SortableTh>
                      <th className="tm-num">Latest</th>
                      <th className="tm-num">EWMA</th>
                      <SortableTh sort={sort} sortKey="dev" onToggle={setSort} defaultDir="desc" className="tm-num">Dev %</SortableTh>
                      <th className="tm-num">Change pt</th>
                      <th>Investigate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hits.length === 0 ? (
                      <TableEmpty colSpan={9} title={scopeBackend ? 'No flags for backend' : 'No flagged qubits'} message="Change metric or clear the backend filter." />
                    ) : hits.map((h, i) => (
                      <tr key={`${h.backend_id}-${h.qubit_index}`}>
                        <td>{i + 1}</td>
                        <td>{h.backend_name || h.backend_id}<div className="page-hint" style={{ margin: 0 }}>{modOf(h.backend_id)}</div></td>
                        <td><button type="button" className="tm-rowbtn" onClick={() => setSelected(h)}>Q{h.qubit_index}</button></td>
                        <td><span className={`badge ${sevOf(h.status).badge}`}>{h.status}</span></td>
                        <td className="tm-num">{fmtMetric(h.latest_value, metric)}</td>
                        <td className="tm-num">{fmtMetric(h.latest_ewma, metric)}</td>
                        <td className="tm-num">{h.dev == null ? '—' : `${h.dev > 0 ? '+' : ''}${fmtNum(h.dev, 1)}%`}</td>
                        <td className="tm-num">{h.change_point_index ?? '—'}</td>
                        <td>
                          <div className="dvt-actions tm-actions">
                            <button type="button" className="btn btn-primary btn--xs" onClick={() => setSelected(h)}>Series</button>
                            <button type="button" className="btn btn-secondary btn--xs" onClick={() => navigate(healthLink(h.backend_id, h.qubit_index))}>Workspace</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <DetailDrawer
        open={!!selected}
        title={selected ? `Q${selected.qubit_index}` : ''}
        subtitle={selected ? `${selected.backend_name || selected.backend_id} · ${METRICS[metric].label}` : undefined}
        headerAside={selected ? <span className={`badge ${sevOf(selected.status).badge}`}>{selected.status}</span> : null}
        size="lg"
        onClose={() => setSelected(null)}
      >
        {selected && <QubitDrawerBody hit={selected} metric={metric} modality={modOf(selected.backend_id)} nav={navigate} />}
      </DetailDrawer>
    </div>
  );
};
