import React, { useEffect, useMemo, useState } from 'react';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { Radio } from 'lucide-react';
import { formatISTTime } from '../utils/time';
import { BASE_URL } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { useTheme } from '../components/ui/ThemeProvider';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { ContextBar } from '../components/observability/ContextBar.jsx';
import { useAppScope } from '../hooks/useAppScope.js';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { baseTooltip, getChartTheme } from '../components/observability/chartTheme.js';
import './LiveTelemetry.css';
import './TelemetryPages.css';

const MODALITY_COLORS = ['#059669', '#7c3aed', '#0284c7', '#d97706', '#64748b'];

const fmtT1 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} s`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} ms`;
  return `${n.toFixed(1)} µs`;
};

/** Parse ISO; tolerate naive UTC from API. */
function tsMs(iso) {
  if (!iso) return null;
  const t = Date.parse(iso.includes('T') && !/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? `${iso}Z` : iso);
  return Number.isFinite(t) ? t : null;
}

export const LiveTelemetry = () => {
  const { backend: scopeBackend } = useAppScope();
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const [streamLogs, setStreamLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    let streamUrl = `${BASE_URL}/events/stream`;
    try {
      const raw = localStorage.getItem('quantum_user');
      const token = raw ? JSON.parse(raw)?.token : null;
      if (token) streamUrl += `?access_token=${encodeURIComponent(token)}`;
    } catch {
      /* ignore */
    }
    const eventSource = new EventSource(streamUrl);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStreamLogs((prev) => [data, ...prev].slice(0, 40));
        setIsConnected(true);
      } catch (err) {
        console.error('SSE Parse Error', err);
      }
    };
    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
    };
    return () => eventSource.close();
  }, []);

  const chrono = useMemo(() => [...streamLogs].reverse(), [streamLogs]);

  const modalityKeys = useMemo(() => {
    const set = new Set();
    chrono.forEach((l) => {
      (l.t1_by_modality || []).forEach((m) => set.add(m.qpu_modality));
    });
    return [...set];
  }, [chrono]);

  const tickGaps = useMemo(() => {
    const gaps = [];
    for (let i = 1; i < chrono.length; i += 1) {
      const a = tsMs(chrono[i - 1].timestamp || chrono[i - 1].ui_tick_at);
      const b = tsMs(chrono[i].timestamp || chrono[i].ui_tick_at);
      gaps.push(a != null && b != null ? Math.max(0, (b - a) / 1000) : null);
    }
    // first point has no prior tick
    return [null, ...gaps];
  }, [chrono]);

  const formatModalityT1Log = (log) => {
    const parts = (log.t1_by_modality || [])
      .map((m) => `${m.qpu_modality}:${fmtT1(m.t1_mean_us)}`)
      .join(' · ');
    return parts || '—';
  };

  const theme = getChartTheme(isDark);
  const xLabels = chrono.map((l) => formatISTTime(l.timestamp || l.ui_tick_at));

  // Ops only — never mix counts with µs-scale T1 on one plot.
  const opsChartOption = useMemo(
    () => ({
      backgroundColor: 'transparent',
      tooltip: baseTooltip(isDark),
      legend: { bottom: 0, textStyle: { fontSize: 11, color: theme.textColor } },
      grid: { left: 8, right: 8, top: 16, bottom: 36, containLabel: true },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLine: { lineStyle: { color: theme.axisLine } },
        axisLabel: { color: theme.textColor, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: 'count',
        minInterval: 1,
        axisLabel: { color: theme.textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: theme.splitColor } },
      },
      series: [
        {
          name: 'Active alerts',
          type: 'line',
          smooth: true,
          data: chrono.map((l) => l.active_alerts ?? 0),
          itemStyle: { color: '#e11d48' },
        },
        {
          name: 'Pending jobs',
          type: 'line',
          smooth: true,
          data: chrono.map((l) => l.pending_jobs ?? l.queued_jobs ?? 0),
          itemStyle: { color: '#0284c7' },
        },
        {
          name: 'Running jobs',
          type: 'line',
          smooth: true,
          data: chrono.map((l) => l.running_jobs ?? 0),
          itemStyle: { color: '#059669' },
        },
      ],
    }),
    [chrono, isDark, theme.axisLine, theme.splitColor, theme.textColor, xLabels],
  );

  // T1 alone, log axis — superconducting (~1e2 µs) and trapped-ion (~1e7 µs) share log scale.
  const t1ChartOption = useMemo(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
        ...baseTooltip(isDark),
        formatter: (params) => {
          const rows = Array.isArray(params) ? params : [params];
          if (!rows.length) return '';
          const head = rows[0].axisValueLabel || rows[0].name || '';
          const lines = rows
            .filter((p) => p.value != null && Number.isFinite(Number(p.value)))
            .map((p) => `${p.marker}${p.seriesName}: <b>${fmtT1(p.value)}</b>`);
          return [`${head}`, ...lines].join('<br/>');
        },
      },
      legend: { bottom: 0, textStyle: { fontSize: 11, color: theme.textColor } },
      grid: { left: 8, right: 8, top: 16, bottom: 36, containLabel: true },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLine: { lineStyle: { color: theme.axisLine } },
        axisLabel: { color: theme.textColor, fontSize: 10 },
      },
      yAxis: {
        type: 'log',
        name: 'T1 (µs, log)',
        min: 1,
        axisLabel: {
          color: theme.textColor,
          fontSize: 10,
          formatter: (v) => fmtT1(v),
        },
        splitLine: { lineStyle: { color: theme.splitColor } },
      },
      series: modalityKeys.map((mod, idx) => ({
        name: mod,
        type: 'line',
        smooth: true,
        connectNulls: false,
        data: chrono.map((l) => {
          const row = (l.t1_by_modality || []).find((x) => x.qpu_modality === mod);
          const v = row?.t1_mean_us;
          // log axis rejects ≤0
          return v != null && Number(v) > 0 ? Number(v) : null;
        }),
        itemStyle: { color: MODALITY_COLORS[idx % MODALITY_COLORS.length] },
      })),
    }),
    [chrono, isDark, modalityKeys, theme.axisLine, theme.splitColor, theme.textColor, xLabels],
  );

  const cadenceChartOption = useMemo(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
        ...baseTooltip(isDark),
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0] : params;
          if (!p || p.value == null) return `${p?.axisValueLabel || ''} —`;
          return `${p.axisValueLabel}<br/>Tick gap: <b>${Number(p.value).toFixed(1)} s</b>`;
        },
      },
      grid: { left: 8, right: 8, top: 12, bottom: 28, containLabel: true },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLine: { lineStyle: { color: theme.axisLine } },
        axisLabel: { color: theme.textColor, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: 's',
        min: 0,
        axisLabel: { color: theme.textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: theme.splitColor } },
      },
      series: [
        {
          name: 'SSE tick gap',
          type: 'bar',
          data: tickGaps,
          itemStyle: { color: '#64748b' },
          barMaxWidth: 14,
        },
        {
          name: 'Measurement age',
          type: 'line',
          data: chrono.map((l) =>
            l.staleness_seconds != null && Number.isFinite(Number(l.staleness_seconds))
              ? Number(l.staleness_seconds)
              : null,
          ),
          itemStyle: { color: '#d97706' },
        },
      ],
      legend: { bottom: 0, textStyle: { fontSize: 11, color: theme.textColor } },
    }),
    [chrono, isDark, theme.axisLine, theme.splitColor, theme.textColor, tickGaps, xLabels],
  );

  if (!streamLogs.length && isConnected) return <BoneyardSkeleton layout="grid" />;

  const latest = streamLogs[0] || {};
  const latestModality = latest.t1_by_modality || [];
  const lastGap = tickGaps.length > 1 ? tickGaps[tickGaps.length - 1] : null;

  return (
    <div className="page-stack">
      {scopeBackend && <ContextBar backend={scopeBackend} readOnly />}
      {!isConnected && streamLogs.length === 0 && (
        <EmptyState
          variant="panel"
          title="Stream disconnected"
          message="Reload the page to reconnect. Session token must be valid for SSE."
        />
      )}
      <div className="page-kpi-grid">
        <div className="card">
          <div className="card-title">
            <span>Active alerts</span>
            <Radio size={16} />
          </div>
          <div className="card-value">{latest.active_alerts ?? '—'}</div>
          <div
            className="card-subtitle"
            title="SSE aggregate stream; new frames about every 5 seconds from platform storage."
          >
            {isConnected ? 'Live · ~5s' : 'Offline'}
          </div>
        </div>
        <div className="card">
          <div className="card-title">
            <span>Pending jobs</span>
          </div>
          <div className="card-value">{latest.pending_jobs ?? latest.queued_jobs ?? '—'}</div>
          <div className="card-subtitle">queued · running {latest.running_jobs ?? '—'}</div>
        </div>
        <div className="card telemetry-modality-strip">
          <div className="card-title">
            <span>T1 by modality</span>
          </div>
          <div className="telemetry-modality-row">
            {latestModality.length === 0 ? (
              <span className="card-subtitle">No coherence samples</span>
            ) : (
              latestModality.map((m) => (
                <div key={m.qpu_modality}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {m.qpu_modality}
                  </div>
                  <div className="card-value" style={{ fontSize: 20 }}>
                    {fmtT1(m.t1_mean_us)}
                  </div>
                  <div className="card-subtitle">
                    {m.backend_count} backend{m.backend_count === 1 ? '' : 's'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-title">
            <span>Last tick gap</span>
          </div>
          <div className="card-value">
            {lastGap != null ? `${lastGap.toFixed(1)}s` : '—'}
          </div>
          <div className="card-subtitle">
            age {latest.staleness_seconds != null ? `${latest.staleness_seconds}s` : '—'} ·{' '}
            {streamLogs.length} ticks
          </div>
        </div>
      </div>

      <div className="live-layout">
        <div className="card page-panel">
          <h3 className="page-section-title">Platform refresh log</h3>
          <div className="live-log">
            {streamLogs.map((log, idx) => (
              <div key={idx} className="telemetry-log-line">
                [{formatISTTime(log.timestamp)}] alerts {log.active_alerts ?? '—'} · pending{' '}
                {log.pending_jobs ?? log.queued_jobs ?? '—'} · T1 {formatModalityT1Log(log)}
              </div>
            ))}
          </div>
        </div>

        <ChartPanel
          title="Alerts & queue depth"
          question="How are active alerts and pending/running jobs moving across platform refresh ticks?"
          sourceKind="cached"
          state={chrono.length > 0 ? 'ready' : 'empty'}
          emptyTitle="No refresh events"
          emptyMessage="Waiting for the next platform refresh tick."
          minHeight={300}
        >
          <QtECharts option={opsChartOption} style={{ height: 'min(320px, 42vh)', minHeight: 260 }} />
        </ChartPanel>
      </div>

      <div className="live-charts-row" data-tour="page-live-chart">
        <ChartPanel
          title="T1 by modality"
          question="Mean T1 over time per modality (log scale — ion vs superconducting differ by orders of magnitude)."
          sourceKind="cached"
          state={modalityKeys.length && chrono.length ? 'ready' : 'empty'}
          emptyTitle="No coherence samples"
          emptyMessage="No T1-by-modality rows in the stream yet."
          minHeight={300}
        >
          <QtECharts option={t1ChartOption} style={{ height: 'min(320px, 42vh)', minHeight: 260 }} />
        </ChartPanel>

        <ChartPanel
          title="Refresh cadence & measurement age"
          question="SSE tick gap (should ~5s) vs age of latest stored qubit/backend telemetry."
          sourceKind="cached"
          state={chrono.length > 1 ? 'ready' : 'empty'}
          emptyTitle="Need more ticks"
          emptyMessage="Cadence needs at least two refresh frames."
          minHeight={300}
        >
          <QtECharts
            option={cadenceChartOption}
            style={{ height: 'min(320px, 42vh)', minHeight: 260 }}
          />
        </ChartPanel>
      </div>
    </div>
  );
};
