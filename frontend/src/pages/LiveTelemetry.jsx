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

  const chrono = [...streamLogs].reverse();
  const modalityKeys = useMemo(() => {
    const set = new Set();
    chrono.forEach((l) => {
      (l.t1_by_modality || []).forEach((m) => set.add(m.qpu_modality));
    });
    return [...set];
  }, [chrono]);

  const fmtT1 = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)} s`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)} ms`;
    return `${n.toFixed(1)} µs`;
  };

  const formatModalityT1Log = (log) => {
    const parts = (log.t1_by_modality || [])
      .map((m) => `${m.qpu_modality}:${fmtT1(m.t1_mean_us)}`)
      .join(' · ');
    return parts || '—';
  };

  const theme = getChartTheme(isDark);

  const streamChartOption = {
    backgroundColor: 'transparent',
    tooltip: baseTooltip(isDark),
    legend: { bottom: 0, textStyle: { fontSize: 11, color: theme.textColor } },
    grid: { left: 8, right: 8, top: 16, bottom: 36, containLabel: true },
    xAxis: {
      type: 'category',
      data: chrono.map((l) => formatISTTime(l.timestamp)),
      axisLine: { lineStyle: { color: theme.axisLine } },
      axisLabel: { color: theme.textColor, fontSize: 10 },
    },
    yAxis: [
      {
        type: 'value',
        name: 'count',
        axisLabel: { color: theme.textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: theme.splitColor } },
      },
      {
        type: 'value',
        name: 'T1 µs (per modality)',
        axisLabel: { color: theme.textColor, fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    series: [
      { name: 'Active alerts', type: 'line', data: chrono.map((l) => l.active_alerts ?? 0), itemStyle: { color: '#e11d48' } },
      { name: 'Pending jobs', type: 'line', data: chrono.map((l) => l.pending_jobs ?? l.queued_jobs ?? 0), itemStyle: { color: '#0284c7' } },
      ...modalityKeys.map((mod, idx) => ({
        name: `T1 · ${mod}`,
        type: 'line',
        yAxisIndex: 1,
        connectNulls: false,
        data: chrono.map((l) => {
          const row = (l.t1_by_modality || []).find((x) => x.qpu_modality === mod);
          return row?.t1_mean_us ?? null;
        }),
        itemStyle: { color: MODALITY_COLORS[idx % MODALITY_COLORS.length] },
      })),
    ],
  };

  if (!streamLogs.length && isConnected) return <BoneyardSkeleton layout="grid" />;

  const latest = streamLogs[0] || {};
  const latestModality = latest.t1_by_modality || [];
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
          <div className="card-title"><span>Active alerts</span><Radio size={16} /></div>
          <div className="card-value">{latest.active_alerts ?? '—'}</div>
          <div className="card-subtitle" title="SSE aggregate stream; new frames about every 5 seconds from platform storage.">
            {isConnected ? 'Live · ~5s' : 'Offline'}
          </div>
        </div>
        <div className="card">
          <div className="card-title"><span>Pending jobs</span></div>
          <div className="card-value">{latest.pending_jobs ?? latest.queued_jobs ?? '—'}</div>
          <div className="card-subtitle">queued + running {latest.running_jobs ?? '—'}</div>
        </div>
        <div className="card telemetry-modality-strip">
          <div className="card-title"><span>T1 by modality</span></div>
          <div className="telemetry-modality-row">
            {latestModality.length === 0 ? (
              <span className="card-subtitle">No coherence samples</span>
            ) : (
              latestModality.map((m) => (
                <div key={m.qpu_modality}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{m.qpu_modality}</div>
                  <div className="card-value" style={{ fontSize: 20 }}>{fmtT1(m.t1_mean_us)}</div>
                  <div className="card-subtitle">{m.backend_count} backend{m.backend_count === 1 ? '' : 's'}</div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-title"><span>Ticks buffered</span></div>
          <div className="card-value">{streamLogs.length}</div>
          <div className="card-subtitle">last {formatISTTime(latest.timestamp) || '—'}</div>
        </div>
      </div>
      <div className="live-layout">
        <div className="card page-panel">
          <h3 className="page-section-title">Platform refresh log</h3>
          <div className="live-log">
            {streamLogs.map((log, idx) => (
              <div key={idx} className="telemetry-log-line">
                [{formatISTTime(log.timestamp)}] alerts {log.active_alerts ?? '—'} · pending {log.pending_jobs ?? log.queued_jobs ?? '—'} · T1 {formatModalityT1Log(log)}
              </div>
            ))}
          </div>
        </div>
        <ChartPanel
          title="Alerts / queue / T1 by modality"
          question="Fleet-wide refresh interval over time."
          sourceKind="cached"
          state={chrono.length > 0 ? 'ready' : 'empty'}
          emptyTitle="No refresh events"
          emptyMessage="Waiting for the next platform refresh tick."
          minHeight={380}
        >
          <QtECharts option={streamChartOption} style={{ height: 'min(420px, 50vh)', minHeight: 320 }} />
        </ChartPanel>
      </div>
    </div>
  );
};
