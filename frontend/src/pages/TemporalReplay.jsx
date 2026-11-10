import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { api } from '../services/api';
import { unableToLoad } from '../constants/messages.js';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { ContextBar } from '../components/observability/ContextBar.jsx';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { getChartTheme, baseTooltip, getChartSemanticColors } from '../components/observability/chartTheme.js';
import { useAppScope } from '../hooks/useAppScope.js';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { formatISTTime } from '../utils/time';
import { buildBackendDetailsPath } from '../lib/investigationLinks.js';
import { fmtNum, isStale, modalityOf, timelineLink } from './telemetryPageUtils.js';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { ListPager } from '../components/observability/ListPager.jsx';
import './TelemetryPages.css';

const PLAY_MS = 700;
const FRAME_TABLE_SIZE = 25;
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// 2 = data present, 1 = present but not fresh, 0 = missing
const coverage = (f) => {
  const p = f.panels || {};
  return [
    p.queue?.pending_jobs != null ? (p.queue.data_quality === 'VALID' ? 2 : 1) : 0,
    p.coherence?.qubit_samples > 0 ? 2 : 0,
    p.calibration?.freshness_status ? (p.calibration.freshness_status === 'Fresh' ? 2 : 1) : 0,
  ];
};
const ROWS = ['Queue', 'Coherence', 'Calibration'];
const MARK = ['—', '!', '✓'];

function PaginatedFrameTable({ frames, headers, renderRow }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(frames.length / FRAME_TABLE_SIZE));
  const cur = Math.min(page, pages);
  const slice = frames.slice((cur - 1) * FRAME_TABLE_SIZE, cur * FRAME_TABLE_SIZE);
  const base = (cur - 1) * FRAME_TABLE_SIZE;
  return (
    <>
      <div className="tm-table-wrap">
        <table className="custom-table custom-table--dense">
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              {headers.map((h) => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {slice.map((f, i) => renderRow(f, base + i))}
          </tbody>
        </table>
      </div>
      <ListPager page={cur} pages={pages} onPage={setPage} label="Table page" />
    </>
  );
}

export const TemporalReplay = () => {
  const navigate = useNavigate();
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const th = getChartTheme(isDark);
  const { backend: backendId, setBackend } = useAppScope();
  const [backends, setBackends] = useState([]);
  const [timeline, setTimeline] = useState(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const { setActions, clearActions } = usePageActions();
  const noMotion = reducedMotion();

  useEffect(() => {
    api.getBackends()
      .then((res) => {
        const list = res || [];
        setBackends(list);
        if (list.length && !(backendId && list.some((b) => b.backend_id === backendId))) setBackend(list[0].backend_id);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [backendId, setBackend]);

  const loadTimeline = useCallback(() => {
    if (!backendId) return;
    setLoading(true);
    setError(false);
    setPlaying(false);
    api.getReplayTimeline(backendId, 200)
      .then((tl) => { setTimeline(tl); setIndex(Math.max(0, (tl.frame_count || 1) - 1)); setLastRefresh(new Date()); })
      .catch(() => { setTimeline(null); setError(true); })
      .finally(() => setLoading(false));
  }, [backendId]);
  useEffect(() => { loadTimeline(); }, [loadTimeline]);
  useEffect(() => {
    setActions(<RefreshButton onClick={loadTimeline} lastRefreshAt={lastRefresh} label="Refresh replay" />);
    return () => clearActions();
  }, [loadTimeline, lastRefresh, setActions, clearActions]);

  const frames = useMemo(() => timeline?.frames || [], [timeline]);
  const maxIdx = Math.max(0, frames.length - 1);
  const frame = frames[index];

  useEffect(() => {
    if (!playing || noMotion) return undefined;
    const id = setInterval(() => setIndex((i) => {
      if (i >= maxIdx) { setPlaying(false); return i; }
      return i + 1;
    }), PLAY_MS);
    return () => clearInterval(id);
  }, [playing, maxIdx, noMotion]);

  const labels = useMemo(() => frames.map((f) => formatISTTime(f.at, false)), [frames]);
  const cursor = labels[index];

  const trendOption = useMemo(() => {
    const sem = getChartSemanticColors();
    return {
      backgroundColor: 'transparent',
      tooltip: baseTooltip(isDark),
      legend: { top: 0, textStyle: { color: th.textColor } },
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { color: th.textColor }, axisLine: { lineStyle: { color: th.axisLine } } },
      yAxis: [
        { type: 'value', name: 'pending jobs', axisLabel: { color: th.textColor }, splitLine: { lineStyle: { color: th.splitColor } } },
        { type: 'value', name: 'wait (s)', axisLabel: { color: th.textColor }, splitLine: { show: false } },
      ],
      series: [
        {
          name: 'Pending jobs', type: 'line', data: frames.map((f) => f.panels?.queue?.pending_jobs ?? null), connectNulls: false,
          markLine: cursor ? { symbol: 'none', silent: true, data: [{ xAxis: cursor, label: { formatter: 'frame', color: th.textColor }, lineStyle: { color: sem.accent, width: 2 } }] } : undefined,
        },
        { name: 'Est. wait (s)', type: 'line', yAxisIndex: 1, data: frames.map((f) => f.panels?.queue?.estimated_wait_time ?? null), connectNulls: false, lineStyle: { type: 'dashed' } },
      ],
    };
  }, [frames, labels, cursor, isDark, th]);

  const covOption = useMemo(() => {
    const sem = getChartSemanticColors();
    return {
      backgroundColor: 'transparent',
      tooltip: { ...baseTooltip(isDark), trigger: 'item', formatter: (p) => `${ROWS[p.data[1]]} · ${labels[p.data[0]]}<br/>${['missing', 'present, not fresh/valid', 'present'][p.data[2]]}` },
      grid: { left: 8, right: 8, top: 8, bottom: 52, containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { color: th.textColor, hideOverlap: true }, axisLine: { lineStyle: { color: th.axisLine } } },
      yAxis: { type: 'category', data: ROWS, axisLabel: { color: th.textColor } },
      visualMap: { type: 'piecewise', orient: 'horizontal', left: 'center', bottom: 0, textStyle: { color: th.textColor }, pieces: [
        { value: 0, label: '— missing', color: sem.unknown }, { value: 1, label: '! not fresh', color: sem.warn }, { value: 2, label: '✓ present', color: sem.healthy }] },
      series: [{
        type: 'heatmap',
        data: frames.flatMap((f, x) => coverage(f).map((v, y) => [x, y, v])),
        label: { show: frames.length <= 40, color: '#0b1220', formatter: (p) => MARK[p.data[2]] },
        itemStyle: { borderColor: th.splitColor, borderWidth: 1 },
        markLine: cursor ? { symbol: 'none', silent: true, data: [{ xAxis: cursor, lineStyle: { color: sem.accent, width: 2 } }] } : undefined,
      }],
    };
  }, [frames, labels, cursor, isDark, th]);

  const onChartClick = (p) => { const i = p.data?.[0]; if (Number.isInteger(i)) setIndex(i); };
  const p = frame?.panels || {};
  const lastAt = frames[frames.length - 1]?.at;
  const modality = modalityOf(backends, backendId);

  return (
    <div className="page-stack">
      <ContextBar
        backend={backendId}
        backends={backends}
        onBackendChange={setBackend}
      />

      {error && <ErrorState variant="panel" message={unableToLoad('replay timeline')} onRetry={loadTimeline} />}
      {!error && !loading && !backends.length && <EmptyState variant="panel" title="No backends" message="No backends registered." />}
      {!error && !loading && backends.length > 0 && !frames.length && (
        <EmptyState variant="panel" title="No replay frames" message="No stored telemetry for this backend. Wait for collector cycles." />
      )}
      {!error && loading && !timeline && <BoneyardSkeleton layout="grid" />}

      {frames.length > 0 && (
        <>
          {isStale(lastAt) && <p className="tm-callout">Stale: newest frame is {formatISTTime(lastAt)}. The collector may be paused for this backend.</p>}
          <div className="card tm-player" role="group" aria-label="Replay controls">
            <button type="button" className="btn btn-secondary" onClick={() => { setPlaying(false); setIndex((i) => Math.max(0, i - 1)); }} aria-label="Previous frame" disabled={index <= 0}><SkipBack size={16} /></button>
            <button
              type="button" className="btn btn-primary" onClick={() => { if (index >= maxIdx) setIndex(0); setPlaying((v) => !v); }}
              aria-label={playing ? 'Pause' : 'Play'} disabled={noMotion || frames.length < 2}
              title={noMotion ? 'Autoplay disabled by your reduced-motion setting. Use step buttons or the slider.' : undefined}
            >{playing ? <Pause size={16} /> : <Play size={16} />}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setPlaying(false); setIndex((i) => Math.min(maxIdx, i + 1)); }} aria-label="Next frame" disabled={index >= maxIdx}><SkipForward size={16} /></button>
            <input id="replay-scrub" type="range" min={0} max={maxIdx} value={index} aria-label="Replay frame" aria-valuetext={`Frame ${index + 1} of ${frames.length}, ${frame?.at ? formatISTTime(frame.at) : ''}`}
              onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }} />
            <span className="page-hint" style={{ margin: 0 }}>Frame {index + 1} / {frames.length} · {frame?.at ? formatISTTime(frame.at) : '—'}</span>
          </div>

          <div className="tm-kpis">
            <div className="tm-kpi"><div className="tm-kpi__label">Pending jobs</div><div className="tm-kpi__value">{p.queue?.pending_jobs ?? '—'}</div><div className="tm-kpi__sub">wait {p.queue?.estimated_wait_time != null ? `${p.queue.estimated_wait_time}s` : '—'} · {p.queue?.data_quality || 'quality n/a'}</div></div>
            <div className="tm-kpi"><div className="tm-kpi__label">Mean T1 {modality ? `(${modality})` : ''}</div><div className="tm-kpi__value">{p.coherence?.t1_mean_us != null ? `${fmtNum(p.coherence.t1_mean_us, 1)} µs` : 'Not available'}</div><div className="tm-kpi__sub">{p.coherence?.qubit_samples ?? 0} qubit samples in ±3 min window</div></div>
            <div className="tm-kpi"><div className="tm-kpi__label">Calibration</div><div className="tm-kpi__value">{p.calibration?.freshness_status ?? 'no data'}</div><div className="tm-kpi__sub">{p.calibration?.calibration_identifier || '—'}{p.calibration?.calibration_age_hours != null ? ` · ${p.calibration.calibration_age_hours}h old` : ''}</div></div>
          </div>

          <div className="tm-split">
            <ChartPanel
              title="Queue and wait across frames"
              titleTo={backendId ? `/app/execution/queues?backend=${encodeURIComponent(backendId)}` : '/app/execution/queues'}
              question="Playhead marks the selected frame. Click to jump." sourceKind="cached" asOf={lastAt ? formatISTTime(lastAt) : undefined}
              minHeight={320}
              tableAlternative={(
                <PaginatedFrameTable
                  frames={frames}
                  headers={['Pending', 'Wait s']}
                  renderRow={(f, i) => (
                    <tr key={f.index ?? i}>
                      <td>{i + 1}</td>
                      <td>{formatISTTime(f.at)}</td>
                      <td>{f.panels?.queue?.pending_jobs ?? '—'}</td>
                      <td>{f.panels?.queue?.estimated_wait_time ?? '—'}</td>
                    </tr>
                  )}
                />
              )}
            ><QtECharts option={trendOption} className="tm-chart" onEvents={{ click: onChartClick }} /></ChartPanel>
            <ChartPanel
              title="Data coverage per frame"
              titleTo={backendId ? `/app/resources/health?backend=${encodeURIComponent(backendId)}` : '/app/resources/health'}
              question="Panels with data at each frame (missing counts are explicit)." sourceKind="cached" minHeight={320}
              help="Per-qubit health is not stored per replay frame, so this map shows panel coverage. For qubit health open Resource health."
              tableAlternative={(
                <PaginatedFrameTable
                  frames={frames}
                  headers={ROWS}
                  renderRow={(f, i) => (
                    <tr key={f.index ?? i}>
                      <td>{i + 1}</td>
                      <td>{formatISTTime(f.at)}</td>
                      {coverage(f).map((v, k) => <td key={k}>{['missing', 'not fresh', 'present'][v]}</td>)}
                    </tr>
                  )}
                />
              )}
            ><QtECharts option={covOption} className="tm-chart" onEvents={{ click: onChartClick }} /></ChartPanel>
          </div>

          <nav className="link-row tm-actions" aria-label="Related pages">
            <button type="button" className="fs-link" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }} onClick={() => navigate(buildBackendDetailsPath(backendId))}>Backend details</button>
            <button type="button" className="fs-link" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }} onClick={() => navigate(timelineLink(backendId))}>Investigation timeline</button>
          </nav>
        </>
      )}
    </div>
  );
};
