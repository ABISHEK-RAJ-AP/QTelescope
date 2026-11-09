import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { api } from '../services/api';
import { formatISTTime } from '../utils/time';
import { useTheme } from '../components/ui/ThemeProvider';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { ContextBar } from '../components/observability/ContextBar.jsx';
import { useAppScope } from '../hooks/useAppScope.js';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { baseTooltip, getChartTheme, getChartSemanticColors } from '../components/observability/chartTheme.js';
import { parseDate } from '../utils/time';
import { readTelemetryWindowHours, writeTelemetryWindowHours } from '../utils/telemetryWindow';
import './HistoricalTrends.css';
import './TelemetryPages.css';

function seriesStats(values) {
  const v = values.filter((x) => x != null && Number.isFinite(Number(x))).map(Number);
  if (!v.length) return null;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  return { min, max, mean, n: v.length };
}

export const HistoricalTrends = () => {
  const navigate = useNavigate();
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
  const [backends, setBackends] = useState([]);
  const selectedBackend = scopeBackend;
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
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

  const loadHistory = useCallback(() => {
    if (!selectedBackend) return;
    api.getBackendTelemetry(selectedBackend)
      .then((h) => {
        setHistory(h);
        setLastRefresh(new Date());
      })
      .catch(() => setHistory([]));
  }, [selectedBackend]);

  useEffect(() => { loadBackends(); }, [loadBackends]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    setActions(
      <RefreshButton
        onClick={() => { loadBackends(); loadHistory(); }}
        lastRefreshAt={lastRefresh}
        label="Refresh trends"
      />,
    );
    return () => clearActions();
  }, [loadBackends, loadHistory, lastRefresh, setActions, clearActions]);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - windowHours * 3.6e6;
    return history.filter((h) => {
      const ms = parseDate(h.timestamp)?.getTime();
      return ms == null || ms >= cutoff;
    });
  }, [history, windowHours]);

  const xLabels = useMemo(() => filtered.map((h) => formatISTTime(h.timestamp, false)), [filtered]);
  const asOf = filtered.length ? formatISTTime(filtered[filtered.length - 1].timestamp) : null;
  const queueStats = useMemo(() => seriesStats(filtered.map((h) => h.pending_jobs)), [filtered]);
  const waitStats = useMemo(() => seriesStats(filtered.map((h) => h.estimated_wait_time)), [filtered]);

  const queueChartOption = useMemo(() => {
    const sem = getChartSemanticColors();
    return {
      backgroundColor: 'transparent',
      tooltip: baseTooltip(isDark),
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLine: { lineStyle: { color: theme.axisLine } },
        axisLabel: { color: theme.textColor },
      },
      yAxis: {
        type: 'value',
        name: 'Pending Jobs',
        axisLine: { lineStyle: { color: theme.axisLine } },
        splitLine: { lineStyle: { color: theme.splitColor } },
        axisLabel: { color: theme.textColor },
      },
      series: [
        {
          name: 'Pending Jobs',
          type: 'line',
          smooth: true,
          areaStyle: { opacity: 0.15 },
          data: filtered.map((h) => h.pending_jobs ?? null),
          connectNulls: false,
          itemStyle: { color: sem.healthy },
        },
      ],
    };
  }, [filtered, isDark, theme, xLabels]);

  const waitChartOption = useMemo(() => {
    const sem = getChartSemanticColors();
    return {
      backgroundColor: 'transparent',
      tooltip: baseTooltip(isDark),
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: xLabels,
        axisLine: { lineStyle: { color: theme.axisLine } },
        axisLabel: { color: theme.textColor },
      },
      yAxis: {
        type: 'value',
        name: 'Wait Time (s)',
        axisLine: { lineStyle: { color: theme.axisLine } },
        splitLine: { lineStyle: { color: theme.splitColor } },
        axisLabel: { color: theme.textColor },
      },
      series: [
        {
          name: 'Est. Wait Time (s)',
          type: 'line',
          smooth: true,
          data: filtered.map((h) => h.estimated_wait_time ?? null),
          connectNulls: false,
          itemStyle: { color: sem.accent },
        },
      ],
    };
  }, [filtered, isDark, theme, xLabels]);

  if (loading) return <BoneyardSkeleton layout="grid" />;
  if (!backends.length) {
    return (
      <div className="page-stack">
        <EmptyState variant="panel" title="No backends" message="Register QPUs in Administration." />
      </div>
    );
  }

  const hasHistory = filtered.length > 0;

  return (
    <div className="page-stack">
      <div data-tour="page-telemetry-filters">
        <ContextBar
          backend={selectedBackend}
          backends={backends}
          onBackendChange={setBackend}
          hours={windowHours}
          onHoursChange={setWindowHours}
          showTimeRange
          timeRangeAffectsQuery={false}
        />
      </div>

      {hasHistory && (
        <div className="tm-kpis">
          <div className="tm-kpi"><div className="tm-kpi__label">Samples</div><div className="tm-kpi__value">{filtered.length}</div><div className="tm-kpi__sub">in {windowHours}h window</div></div>
          <div className="tm-kpi"><div className="tm-kpi__label">Latest pending</div><div className="tm-kpi__value">{filtered[filtered.length - 1]?.pending_jobs ?? '—'}</div><div className="tm-kpi__sub">{asOf ? `as of ${asOf}` : ''}</div></div>
          <div className="tm-kpi"><div className="tm-kpi__label">Latest wait</div><div className="tm-kpi__value">{filtered[filtered.length - 1]?.estimated_wait_time != null ? `${filtered[filtered.length - 1].estimated_wait_time}s` : '—'}</div><div className="tm-kpi__sub">estimated queue wait</div></div>
        </div>
      )}

      {hasHistory && (queueStats || waitStats) && (
        <section className="card page-panel">
          <h3 className="page-section-title">Window statistics</h3>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="custom-table custom-table--dense">
              <thead><tr><th>Series</th><th>Min</th><th>Mean</th><th>Max</th><th>n</th></tr></thead>
              <tbody>
                {queueStats && <tr><td>Pending jobs</td><td>{queueStats.min}</td><td>{queueStats.mean.toFixed(1)}</td><td>{queueStats.max}</td><td>{queueStats.n}</td></tr>}
                {waitStats && <tr><td>Wait (s)</td><td>{waitStats.min}</td><td>{waitStats.mean.toFixed(1)}</td><td>{waitStats.max}</td><td>{waitStats.n}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="trends-chart-grid">
        <ChartPanel
          title="Historical queue length"
          sourceKind="cached"
          asOf={asOf}
          state={hasHistory ? 'ready' : 'empty'}
          emptyTitle="No queue history"
          emptyMessage="Collector has not stored telemetry samples for this backend."
          minHeight={380}
        >
          <QtECharts option={queueChartOption} style={{ height: 380 }} />
        </ChartPanel>

        <ChartPanel
          title="Estimated wait time"
          sourceKind="cached"
          asOf={asOf}
          state={hasHistory ? 'ready' : 'empty'}
          emptyTitle="No wait history"
          emptyMessage="Estimated wait time was not recorded in stored samples."
          minHeight={380}
        >
          <QtECharts option={waitChartOption} style={{ height: 380 }} />
        </ChartPanel>
      </div>
      {selectedBackend && (
        <div className="tm-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/app/execution/queues?backend=${encodeURIComponent(selectedBackend)}`)}>Queues</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/app/telemetry/compare?backends=${encodeURIComponent(selectedBackend)}`)}>Compare</button>
        </div>
      )}
    </div>
  );
};
