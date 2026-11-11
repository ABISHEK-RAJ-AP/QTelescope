import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { Radio } from 'lucide-react';
import { formatISTTime } from '../utils/time';
import { BASE_URL, fetchApi } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { useTheme } from '../components/ui/ThemeProvider';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { ContextBar } from '../components/observability/ContextBar.jsx';
import { useAppScope } from '../hooks/useAppScope.js';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { baseTooltip, getChartTheme, getChartSemanticColors, getModalityChartPalette } from '../components/observability/chartTheme.js';
import './LiveTelemetry.css';
import './TelemetryPages.css';

const ION_MODALITIES = new Set(['trapped_ion', 'trapped-ion', 'ion_trap']);
const isIonModality = (mod) => ION_MODALITIES.has(String(mod || '').toLowerCase());

const fmtT1 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} s`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} ms`;
  return `${n.toFixed(1)} µs`;
};

const fmtT1Seconds = (microUs) => {
  const n = Number(microUs);
  if (!Number.isFinite(n)) return '—';
  return `${(n / 1e6).toFixed(3)} s`;
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
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    let eventSource;
    let reconnectTimer;
    let delayMs = 2000;
    let streamUrl = `${BASE_URL}/events/stream`;
    let ticketExpiresAt = 0;
    let cancelled = false;

    const resolveStreamUrl = async () => {
      if (Date.now() < ticketExpiresAt - 8000) return streamUrl;
      try {
        const raw = localStorage.getItem('quantum_user');
        const token = raw ? JSON.parse(raw)?.token : null;
        if (!token) return `${BASE_URL}/events/stream`;
        const r = await fetchApi('/auth/stream-ticket', { method: 'POST' });
        ticketExpiresAt = Date.now() + (r.expires_in || 180) * 1000;
        streamUrl = `${BASE_URL}/events/stream?stream_ticket=${encodeURIComponent(r.stream_ticket)}`;
        return streamUrl;
      } catch {
        return `${BASE_URL}/events/stream`;
      }
    };

    const connect = async () => {
      if (cancelled) return;
      setReconnecting(false);
      const url = await resolveStreamUrl();
      if (cancelled) return;
      eventSource = new EventSource(url);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setStreamLogs((prev) => [data, ...prev].slice(0, 40));
          setIsConnected(true);
          delayMs = 2000;
        } catch (err) {
          console.error('SSE Parse Error', err);
        }
      };
      eventSource.onerror = () => {
        setIsConnected(false);
        setReconnecting(true);
        eventSource.close();
        ticketExpiresAt = 0;
        reconnectTimer = window.setTimeout(() => {
          delayMs = Math.min(delayMs * 1.5, 15000);
          connect();
        }, delayMs);
      };
    };
    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      eventSource?.close();
    };
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
    () => {
      const sem = getChartSemanticColors();
      return {
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
            itemStyle: { color: sem.critical },
          },
          {
            name: 'Pending jobs',
            type: 'line',
            smooth: true,
            data: chrono.map((l) => l.pending_jobs ?? l.queued_jobs ?? 0),
            itemStyle: { color: sem.accent },
          },
          {
            name: 'Running jobs',
            type: 'line',
            smooth: true,
            data: chrono.map((l) => l.running_jobs ?? 0),
            itemStyle: { color: sem.healthy },
          },
        ],
      };
    },
    [chrono, isDark, theme.axisLine, theme.splitColor, theme.textColor, xLabels],
  );

  const { superModalityKeys, ionModalityKeys } = useMemo(() => {
    const other = [];
    const ion = [];
    modalityKeys.forEach((m) => (isIonModality(m) ? ion : other).push(m));
    return { superModalityKeys: other, ionModalityKeys: ion };
  }, [modalityKeys]);

  const buildT1ModalityChart = useCallback((mods, cfg) => {
    if (!mods.length) return null;
    const modalityColors = getModalityChartPalette();
    return {
      backgroundColor: 'transparent',
      tooltip: {
        ...baseTooltip(isDark),
        formatter: (params) => {
          const rows = Array.isArray(params) ? params : [params];
          if (!rows.length) return '';
          const head = rows[0].axisValueLabel || rows[0].name || '';
          const lines = rows
            .filter((p) => p.value != null && Number.isFinite(Number(p.value)))
            .map((p) => `${p.marker}${p.seriesName}: <b>${cfg.formatValue(p.value)}</b>`);
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
        type: cfg.yType,
        name: cfg.yName,
        min: cfg.yMin,
        axisLabel: {
          color: theme.textColor,
          fontSize: 10,
          formatter: cfg.axisFormatter,
        },
        splitLine: { lineStyle: { color: theme.splitColor } },
      },
      series: mods.map((mod, idx) => ({
        name: mod,
        type: 'line',
        smooth: true,
        connectNulls: false,
        data: chrono.map((l) => {
          const row = (l.t1_by_modality || []).find((x) => x.qpu_modality === mod);
          const v = row?.t1_mean_us;
          return v != null && Number(v) > 0 ? cfg.seriesValue(v) : null;
        }),
        itemStyle: { color: modalityColors[idx % modalityColors.length] },
      })),
    };
  }, [chrono, isDark, theme.axisLine, theme.splitColor, theme.textColor, xLabels]);

  const t1SuperChartOption = useMemo(
    () => buildT1ModalityChart(superModalityKeys, {
      yType: 'log',
      yName: 'T1 (µs, log)',
      yMin: 1,
      seriesValue: (v) => Number(v),
      formatValue: (v) => fmtT1(v),
      axisFormatter: (v) => fmtT1(v),
    }),
    [buildT1ModalityChart, superModalityKeys],
  );

  const t1IonChartOption = useMemo(
    () => buildT1ModalityChart(ionModalityKeys, {
      yType: 'value',
      yName: 'T1 (seconds)',
      yMin: 0,
      seriesValue: (v) => Number(v) / 1e6,
      formatValue: (v) => `${Number(v).toFixed(3)} s`,
      axisFormatter: (v) => `${Number(v).toFixed(2)} s`,
    }),
    [buildT1ModalityChart, ionModalityKeys],
  );

  const cadenceChartOption = useMemo(
    () => {
      const sem = getChartSemanticColors();
      return {
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
          itemStyle: { color: sem.unknown },
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
          itemStyle: { color: sem.warn },
        },
      ],
      legend: { bottom: 0, textStyle: { fontSize: 11, color: theme.textColor } },
    };
    },
    [chrono, isDark, theme.axisLine, theme.splitColor, theme.textColor, tickGaps, xLabels],
  );

  if (!streamLogs.length && isConnected) return <BoneyardSkeleton layout="grid" />;

  const latest = streamLogs[0] || {};
  const latestModality = latest.t1_by_modality || [];
  const lastGap = tickGaps.length > 1 ? tickGaps[tickGaps.length - 1] : null;

  return (
    <div className="page-stack">
      {scopeBackend && <ContextBar backend={scopeBackend} readOnly />}
      {!isConnected && streamLogs.length === 0 && !reconnecting && (
        <EmptyState
          variant="panel"
          title="Stream disconnected"
          message="Reconnecting automatically. Session token must be valid for SSE."
        />
      )}
      {reconnecting && (
        <p className="live-sse-banner" role="status">Stream reconnecting… charts keep the last received data.</p>
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
            data-testid="live-sse-status"
            title="SSE aggregate stream; new frames about every 5 seconds from platform storage."
          >
            {isConnected ? 'Live · ~5s' : 'Offline'}
          </div>
        </div>
        <div className="card">
          <div className="card-title">
            <span>Pending jobs</span>
          </div>
          <div className="card-value">{latest.pending_jobs ?? '—'}</div>
          <div className="card-subtitle">
            queue telemetry · job records queued {latest.queued_jobs_records ?? latest.queued_jobs ?? '—'} · running {latest.running_jobs ?? '—'}
          </div>
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
          titleTo="/app/alerts"
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
        {superModalityKeys.length > 0 ? (
          <ChartPanel
            title="T1 · superconducting & neutral atom"
            titleTo="/app/backends/qubits"
            question="Mean T1 (microseconds, log scale) for non–trapped-ion modalities."
            sourceKind="cached"
            state={chrono.length ? 'ready' : 'empty'}
            emptyTitle="No coherence samples"
            emptyMessage="No T1 rows for these modalities yet."
            minHeight={300}
          >
            <QtECharts option={t1SuperChartOption} style={{ height: 'min(320px, 42vh)', minHeight: 260 }} />
          </ChartPanel>
        ) : null}
        {ionModalityKeys.length > 0 ? (
          <ChartPanel
            title="T1 · trapped ion"
            titleTo="/app/backends/qubits"
            question="Mean T1 in seconds — do not compare directly to superconducting µs charts."
            sourceKind="cached"
            state={chrono.length ? 'ready' : 'empty'}
            emptyTitle="No ion coherence samples"
            emptyMessage="No trapped-ion T1 rows in the stream yet."
            minHeight={300}
          >
            <QtECharts option={t1IonChartOption} style={{ height: 'min(320px, 42vh)', minHeight: 260 }} />
          </ChartPanel>
        ) : null}

        <ChartPanel
          title="Refresh cadence & measurement age"
          titleTo="/app/platform/health"
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
