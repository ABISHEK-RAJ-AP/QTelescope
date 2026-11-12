import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { api, fetchApi } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { DetailDrawer } from '../components/observability/DetailDrawer.jsx';
import {
  DetailModalBody,
  DetailModalSection,
  DetailModalDl,
  DetailModalRow,
  DetailModalRelated,
} from '../components/observability/DetailModalLayout.jsx';
import { PageRelatedLink } from '../components/observability/PageRelatedNav.jsx';
import { TableEmpty } from '../components/observability/EmptyState.jsx';
import { getChartTheme, baseTooltip, getChartSemanticColors } from '../components/observability/chartTheme.js';
import { buildBackendDetailsPath, buildTimelineInvestigationLocation } from '../lib/investigationLinks.js';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { unableToLoad } from '../constants/messages.js';
import { COPY } from '../copy/operator.js';
import { formatIST } from '../utils/time';
import { DataPanelToolbar, SortableTh } from '../components/observability/DataViewToolbar.jsx';
import { ListPager } from '../components/observability/ListPager.jsx';
import './QueueMonitoring.css';

const POLL_MS = 15000;
const HISTORY_PAGE_SIZE = 25;
const COND_MARK = { OPTIMAL: '●', MODERATE: '▲', HEAVY: '■', CONGESTED: '■' };

const toDate = (v) => new Date(v.endsWith('Z') ? v : `${v}Z`);
const fmtWait = (s) => {
  if (s == null) return '—';
  if (s <= 0) return '0s';
  return s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};
// "simulated:ibm_quantum" -> { kind: 'simulated', who: 'ibm_quantum' }
const parseSource = (s) => {
  if (!s) return null;
  const [kind, who] = s.split(':');
  return { kind, who };
};
const SourceTag = ({ source }) => {
  const p = parseSource(source);
  if (!p || p.kind === 'simulated' || p.kind === 'mock_catalog') return null;
  return <span className="qm-src" data-kind={p.kind} title={`Latest telemetry sample source: ${source}`}>{p.kind}</span>;
};

function QueueDrawerBody({ q, an, hist, jobs, nav }) {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const t = getChartTheme(dark);
  const option = useMemo(() => ({
    grid: { left: 8, right: 12, top: 28, bottom: 8, containLabel: true },
    tooltip: baseTooltip(dark),
    legend: { top: 0, textStyle: { color: t.textColor } },
    xAxis: { type: 'time', axisLabel: { color: t.textColor }, axisLine: { lineStyle: { color: t.axisLine } } },
    yAxis: [
      { type: 'value', name: 'jobs', minInterval: 1, axisLabel: { color: t.textColor }, splitLine: { lineStyle: { color: t.splitColor } } },
      { type: 'value', name: 'wait (s)', axisLabel: { color: t.textColor }, splitLine: { show: false } },
    ],
    series: [
      { name: 'Pending', type: 'line', step: 'end', data: (hist || []).map((h) => [toDate(h.timestamp), h.pending_jobs]) },
      { name: 'Est. wait', type: 'line', yAxisIndex: 1, lineStyle: { type: 'dashed' }, data: (hist || []).map((h) => [toDate(h.timestamp), h.estimated_wait_time]) },
    ],
  }), [hist, dark, t]);

  const qd = jobs?.filter((j) => j.status === 'QUEUED').length;
  const rn = jobs?.filter((j) => j.status === 'RUNNING').length;
  return (
    <DetailModalBody>
      <DetailModalSection title="Queue snapshot">
        <DetailModalDl>
          <DetailModalRow label="Pending now">{q.pending_jobs}</DetailModalRow>
          <DetailModalRow label="Est. wait now">{fmtWait(q.estimated_wait_time)}</DetailModalRow>
          <DetailModalRow label="Peak pending / wait">{an?.pending_max ?? '—'} / {fmtWait(an?.wait_max_s)}</DetailModalRow>
          <DetailModalRow label="Mean pending / wait">{an?.pending_mean ?? '—'} / {fmtWait(an?.wait_mean_s)}</DetailModalRow>
          <DetailModalRow label="Samples">{an?.samples ?? 0}</DetailModalRow>
          <DetailModalRow label="Telemetry source"><SourceTag source={an?.telemetry_source_latest} /></DetailModalRow>
          <DetailModalRow label="Trend">{q.trend}</DetailModalRow>
          <DetailModalRow label="Operational status">{q.operational_status}</DetailModalRow>
        </DetailModalDl>
      </DetailModalSection>
      <DetailModalSection title="History">
        {(hist || []).length < 2
          ? <p className="page-hint">{COPY.queue.sparseTrend}</p>
          : <QtECharts option={option} style={{ height: 220 }} />}
      </DetailModalSection>
      <DetailModalSection title="Job records for this backend">
        {jobs == null ? <p className="page-hint">Job records unavailable.</p> : (
          <p className="dm-detail__note">{qd} queued · {rn} running</p>
        )}
      </DetailModalSection>
      <DetailModalSection title="Workspace">
        <button type="button" className="btn btn-primary" onClick={() => nav(`/app/execution/jobs?backend=${encodeURIComponent(q.backend_id)}`)}>Jobs on this backend</button>
      </DetailModalSection>
      <DetailModalRelated>
        <PageRelatedLink onClick={() => nav(buildBackendDetailsPath(q.backend_id, 'execution'))}>Backend execution</PageRelatedLink>
        <PageRelatedLink onClick={() => nav(buildTimelineInvestigationLocation({ backendId: q.backend_id }))}>Timeline</PageRelatedLink>
      </DetailModalRelated>
    </DetailModalBody>
  );
}

export const QueueMonitoring = () => {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const t = getChartTheme(dark);
  const { setActions, clearActions } = usePageActions();

  const [queues, setQueues] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [history, setHistory] = useState({});
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [metric, setMetric] = useState('pending_jobs');
  const [drawerJobs, setDrawerJobs] = useState(null);
  const [layout, setLayout] = useState('table');
  const [sort, setSort] = useState({ key: 'pending', dir: 'desc' });
  const [historyPage, setHistoryPage] = useState(0);
  const selectedId = params.get('queue');
  const backendFilter = params.get('backend') || 'ALL';

  const setBackendFilter = (value) => {
    const next = new URLSearchParams(params);
    if (value === 'ALL') next.delete('backend');
    else next.set('backend', value);
    setParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    try {
      const [qs, an] = await Promise.all([api.getQueues(), api.getQueueAnalytics().catch(() => null)]);
      setQueues(qs || []);
      setAnalytics(an);
      const hs = await Promise.all((qs || []).map((q) => fetchApi(`/queues/${encodeURIComponent(q.backend_id)}/history?limit=100`).catch(() => null)));
      setHistory(Object.fromEntries((qs || []).map((q, i) => [q.backend_id, hs[i]])));
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message || unableToLoad('queue snapshots'));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => { load(); setNow(Date.now()); }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);
  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh queues" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  useEffect(() => {
    if (!selectedId) { setDrawerJobs(null); return undefined; }
    let live = true;
    fetchApi(`/jobs?backend_id=${encodeURIComponent(selectedId)}&limit=200`)
      .then((j) => live && setDrawerJobs(j)).catch(() => live && setDrawerJobs(null));
    return () => { live = false; };
  }, [selectedId]);

  const select = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set('queue', id); else next.delete('queue');
    setParams(next, { replace: true });
  };

  const anBy = useMemo(() => Object.fromEntries((analytics?.backends || []).map((b) => [b.backend_id, b])), [analytics]);
  const ranked = useMemo(() => [...(queues || [])].sort((a, b) => (b.pending_jobs || 0) - (a.pending_jobs || 0)
    || (b.estimated_wait_time || 0) - (a.estimated_wait_time || 0)), [queues]);

  const displayQueues = useMemo(() => {
    let list = ranked.slice();
    if (backendFilter !== 'ALL') {
      list = list.filter((q) => q.backend_id === backendFilter);
    }
    const mul = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let c = 0;
      if (sort.key === 'name') c = String(a.backend_name).localeCompare(String(b.backend_name));
      else if (sort.key === 'wait') c = (a.estimated_wait_time || 0) - (b.estimated_wait_time || 0);
      else c = (a.pending_jobs || 0) - (b.pending_jobs || 0);
      return c * mul;
    });
    return list;
  }, [ranked, sort, backendFilter]);

  const barOption = useMemo(() => {
    const sem = getChartSemanticColors();
    return {
      grid: { left: 8, right: 24, top: 28, bottom: 8, containLabel: true },
      tooltip: { ...baseTooltip(dark), axisPointer: { type: 'shadow' } },
      legend: { top: 0, textStyle: { color: t.textColor } },
      xAxis: [
        { type: 'value', name: 'pending', minInterval: 1, axisLabel: { color: t.textColor }, splitLine: { lineStyle: { color: t.splitColor } } },
        { type: 'value', name: 'wait (s)', show: false },
      ],
      yAxis: { type: 'category', inverse: true, data: ranked.map((q) => q.backend_name), axisLabel: { color: t.textColor }, axisLine: { lineStyle: { color: t.axisLine } } },
      series: [
        { name: 'Pending jobs', type: 'bar', itemStyle: { color: sem.accent }, barGap: '10%', label: { show: true, position: 'right', color: t.textColor }, data: ranked.map((q) => q.pending_jobs || 0) },
        { name: 'Est. wait (s)', type: 'bar', xAxisIndex: 1, itemStyle: { color: sem.warn }, label: { show: true, position: 'right', color: t.textColor, formatter: (p) => fmtWait(p.value) }, data: ranked.map((q) => q.estimated_wait_time || 0) },
      ],
    };
  }, [ranked, dark, t]);

  const withHist = (queues || []).filter((q) => (history[q.backend_id] || []).length > 0);

  const historyRows = useMemo(
    () => withHist.flatMap((q) => (history[q.backend_id] || []).map((h) => ({
      backend_id: q.backend_id,
      backend_name: q.backend_name,
      ...h,
    }))),
    [withHist, history],
  );

  const historyPageCount = Math.max(1, Math.ceil(historyRows.length / HISTORY_PAGE_SIZE));
  const historyPageSafe = Math.min(historyPage, historyPageCount - 1);
  const historySlice = historyRows.slice(
    historyPageSafe * HISTORY_PAGE_SIZE,
    historyPageSafe * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE,
  );

  useEffect(() => {
    setHistoryPage(0);
  }, [historyRows.length, metric]);

  const lineOption = useMemo(() => ({
    grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
    tooltip: baseTooltip(dark),
    legend: { top: 0, textStyle: { color: t.textColor } },
    xAxis: { type: 'time', axisLabel: { color: t.textColor }, axisLine: { lineStyle: { color: t.axisLine } } },
    yAxis: { type: 'value', name: metric === 'pending_jobs' ? 'pending jobs' : 'wait (s)', minInterval: metric === 'pending_jobs' ? 1 : undefined, axisLabel: { color: t.textColor }, splitLine: { lineStyle: { color: t.splitColor } } },
    series: withHist.map((q, i) => ({
      name: q.backend_name, type: 'line', symbol: ['circle', 'rect', 'triangle', 'diamond', 'pin'][i % 5], symbolSize: 7,
      data: history[q.backend_id].map((h) => [toDate(h.timestamp), h[metric === 'pending_jobs' ? 'pending_jobs' : 'estimated_wait_time']]),
    })),
  }), [withHist, history, metric, dark, t]);

  if (!queues && !error) return <BoneyardSkeleton layout="grid" />;
  if (!queues) return <div className="page-stack"><ErrorState variant="panel" message={error} onRetry={load} /></div>;

  const stale = lastRefresh && now - lastRefresh.getTime() > POLL_MS * 2.5;
  const totalPending = queues.reduce((a, q) => a + (q.pending_jobs || 0), 0);
  const waits = queues.filter((q) => q.estimated_wait_time != null);
  const worstWait = waits.length ? [...waits].sort((a, b) => b.estimated_wait_time - a.estimated_wait_time)[0] : null;
  const idle = queues.filter((q) => !q.pending_jobs).length;
  const sel = queues.find((q) => q.backend_id === selectedId);
  const asOf = lastRefresh ? formatIST(lastRefresh) : undefined;

  return (
    <div className="page-stack qm">
      {(error || stale) && (
        <p className="qm-banner" role="status">
          {error ? `Refresh failed (${error}). ` : ''}Showing data from {lastRefresh ? formatIST(lastRefresh) : 'earlier'}; may be stale.
        </p>
      )}

      <section className="qm-kpis" aria-label="Queue summary">
        <div className="qm-kpi"><div className="qm-kpi__label">Total pending</div><div className="qm-kpi__value">{totalPending}</div><div className="qm-kpi__sub">across {queues.length} backends</div></div>
        <div className="qm-kpi"><div className="qm-kpi__label">Longest wait</div><div className="qm-kpi__value">{fmtWait(worstWait?.estimated_wait_time)}</div><div className="qm-kpi__sub">{worstWait ? worstWait.backend_name : '—'}</div></div>
        <div className="qm-kpi"><div className="qm-kpi__label">Idle queues</div><div className="qm-kpi__value">{idle}</div><div className="qm-kpi__sub">of {queues.length} with zero pending</div></div>
        <div className="qm-kpi"><div className="qm-kpi__label">History samples</div><div className="qm-kpi__value">{(analytics?.backends || []).reduce((a, b) => a + b.samples, 0)}</div><div className="qm-kpi__sub">{analytics ? COPY.queue.historySub : 'History unavailable'}</div></div>
      </section>
      <section className="qm-charts">
        <ChartPanel
          title="Queue depth and wait by backend"
          titleTo="/app/execution/jobs"
          question="Current snapshot — longest wait and depth first."
          sourceKind="cached" asOf={asOf}
          provenanceDetail="Latest collected backend telemetry; may differ from vendor portal."
          state={ranked.length ? 'ready' : 'empty'} emptyTitle="No queues" minHeight={Math.max(200, ranked.length * 56 + 60)}
          tableAlternative={(
            <table className="qm-alt">
              <thead><tr><th scope="col">Backend</th><th scope="col">Pending</th><th scope="col">Est. wait</th><th scope="col">Condition</th></tr></thead>
              <tbody>{ranked.map((q) => <tr key={q.backend_id}><th scope="row">{q.backend_name}</th><td>{q.pending_jobs}</td><td>{fmtWait(q.estimated_wait_time)}</td><td>{q.queue_condition}</td></tr>)}</tbody>
            </table>
          )}
        >
          <QtECharts option={barOption} style={{ height: Math.max(200, ranked.length * 56 + 60) }} />
        </ChartPanel>

        <ChartPanel
          title="Queue history"
          titleTo="/app/telemetry/trends"
          question="Trend over the selected time window."
          sourceKind="derived" asOf={asOf}
          provenanceDetail={COPY.queue.historyProvenance}
          state={withHist.length ? 'ready' : 'empty'} emptyTitle="No history" emptyMessage="No stored queue samples yet." minHeight={260}
          actions={(
            <span className="qm-seg" role="group" aria-label="History metric">
              <button type="button" aria-pressed={metric === 'pending_jobs'} onClick={() => setMetric('pending_jobs')}>Pending</button>
              <button type="button" aria-pressed={metric === 'wait'} onClick={() => setMetric('wait')}>Wait</button>
            </span>
          )}
          tableAlternative={(
            <div>
              <table className="qm-alt custom-table custom-table--dense">
                <thead><tr><th scope="col">Backend</th><th scope="col">Time</th><th scope="col">Pending</th><th scope="col">Est. wait</th></tr></thead>
                <tbody>
                  {historySlice.map((h) => (
                    <tr key={`${h.backend_id}${h.timestamp}`}>
                      <th scope="row">{h.backend_name}</th>
                      <td>{formatIST(toDate(h.timestamp))}</td>
                      <td>{h.pending_jobs}</td>
                      <td>{fmtWait(h.estimated_wait_time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {historyRows.length > HISTORY_PAGE_SIZE && (
                <ListPager
                  page={historyPageSafe + 1}
                  pages={historyPageCount}
                  label="History"
                  onPage={(p) => setHistoryPage(p - 1)}
                />
              )}
            </div>
          )}
        >
          <QtECharts option={lineOption} style={{ height: 260 }} />
        </ChartPanel>
      </section>

      <section className="card qm-table-card dvt-panel" data-tour="page-queues">
        <DataPanelToolbar title="Queues" layout={layout} onLayoutChange={setLayout} countLabel={`${displayQueues.length} queue${displayQueues.length === 1 ? '' : 's'}`}>
          <label className="outline-field">
            <span>Backend</span>
            <select
              className="input-control"
              aria-label="Filter queues by backend"
              value={backendFilter}
              onChange={(e) => setBackendFilter(e.target.value)}
            >
              <option value="ALL">All backends</option>
              {(queues || []).map((q) => (
                <option key={q.backend_id} value={q.backend_id}>{q.backend_name || q.backend_id}</option>
              ))}
            </select>
          </label>
        </DataPanelToolbar>
        {layout === 'grid' ? (
          <div className="dvt-grid" aria-label="Queues by backend">
            {displayQueues.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '8px 14px' }}><TableEmpty colSpan={1} title="No queues reported" message="Collectors have not produced queue telemetry." /></div>
            ) : displayQueues.map((q) => {
              const a = anBy[q.backend_id];
              return (
                <article key={q.backend_id} className="dvt-card" data-selected={q.backend_id === selectedId || undefined}>
                  <header className="dvt-card__head">
                    <div>
                      <button type="button" className="qm-link dvt-card__title" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer' }} onClick={() => select(q.backend_id)}>{q.backend_name}</button>
                      <p className="dvt-card__meta">{q.backend_id} · {q.operational_status}</p>
                    </div>
                    <span className="qm-cond" data-c={q.queue_condition}>{q.queue_condition}</span>
                  </header>
                  <dl className="dvt-card__stats">
                    <div><dt>Pending</dt><dd>{q.pending_jobs}</dd></div>
                    <div><dt>Wait now</dt><dd>{fmtWait(q.estimated_wait_time)}</dd></div>
                    <div><dt>Mean / max</dt><dd>{a?.samples ? `${fmtWait(a.wait_mean_s)} / ${fmtWait(a.wait_max_s)}` : '—'}</dd></div>
                    <div><dt>Trend</dt><dd>{q.trend || '—'}</dd></div>
                  </dl>
                  <footer className="dvt-card__foot">
                    <SourceTag source={a?.telemetry_source_latest} />
                    <button type="button" className="btn btn-secondary btn--xs" onClick={() => select(q.backend_id)}>Details</button>
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="qm-scroll">
            <table className="qm-table">
              <caption className="qm-caption">Per-backend queue. Select a row for detail.</caption>
              <thead>
                <tr>
                  <SortableTh sort={sort} sortKey="name" onToggle={setSort} defaultDir="asc">Backend</SortableTh>
                  <th scope="col">Condition</th>
                  <SortableTh sort={sort} sortKey="pending" onToggle={setSort} defaultDir="desc">Pending</SortableTh>
                  <SortableTh sort={sort} sortKey="wait" onToggle={setSort} defaultDir="desc">Wait now</SortableTh>
                  <th scope="col">Wait mean / max</th>
                  <th scope="col">Trend</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {displayQueues.length === 0 ? <TableEmpty colSpan={7} title="No queues reported" message="Collectors have not produced queue telemetry." /> : displayQueues.map((q) => {
                  const a = anBy[q.backend_id];
                  return (
                    <tr key={q.backend_id} data-selected={q.backend_id === selectedId}>
                      <td>
                        <button type="button" className="qm-link" onClick={() => select(q.backend_id)} aria-label={`Open queue detail for ${q.backend_name}`}>{q.backend_name}</button>
                        <div className="qm-sub">{q.backend_id} · {q.operational_status}</div>
                      </td>
                      <td><span className="qm-cond" data-c={q.queue_condition}>{COND_MARK[q.queue_condition] || '○'} {q.queue_condition}</span></td>
                      <td className="qm-num">{q.pending_jobs}</td>
                      <td className="qm-num">{fmtWait(q.estimated_wait_time)}</td>
                      <td className="qm-num">{a?.samples ? `${fmtWait(a.wait_mean_s)} / ${fmtWait(a.wait_max_s)}` : '—'}</td>
                      <td>{q.trend}</td>
                      <td><SourceTag source={a?.telemetry_source_latest} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DetailDrawer
        open={Boolean(sel)}
        title={sel ? (sel.backend_name || sel.backend_id) : ''}
        subtitle={sel ? sel.backend_id : undefined}
        headerAside={sel ? (
          <span className="qm-cond" data-c={sel.queue_condition}>{COND_MARK[sel.queue_condition] || '○'} {sel.queue_condition}</span>
        ) : null}
        size="lg"
        onClose={() => select(null)}
      >
        {sel && <QueueDrawerBody q={sel} an={anBy[sel.backend_id]} hist={history[sel.backend_id]} jobs={drawerJobs} nav={nav} />}
      </DetailDrawer>
    </div>
  );
};
