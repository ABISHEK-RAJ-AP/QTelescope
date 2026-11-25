import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { api } from '../services/api';
import { formatISTChartTick, formatISTTime, parseDate } from '../utils/time';
import { useTheme } from '../components/ui/ThemeProvider';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { useAppScope } from '../hooks/useAppScope.js';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { baseTooltip, getChartTheme, getChartSemanticColors } from '../components/observability/chartTheme.js';
import { readTelemetryWindowHours, telemetryLimitForHours, writeTelemetryWindowHours } from '../utils/telemetryWindow';
import {
  EXPLORER_METRICS,
  deleteSavedQuery,
  listSavedQueries,
  saveQuery,
} from '../lib/metricsExplorerQueries.js';
import './TelemetryPages.css';

function seriesStats(values) {
  const v = values.filter((x) => x != null && Number.isFinite(Number(x))).map(Number);
  if (!v.length) return null;
  return {
    n: v.length,
    min: Math.min(...v),
    max: Math.max(...v),
    mean: v.reduce((a, b) => a + b, 0) / v.length,
  };
}

async function fetchMetricSeries(backendId, metricDef, limit) {
  if (!backendId || !metricDef) return [];
  if (metricDef.source === 'telemetry') {
    const rows = await api.getBackendTelemetry(backendId, { limit });
    return (rows || []).map((r) => ({
      t: r.timestamp,
      v: r[metricDef.field] ?? null,
    }));
  }
  const rows = await api.getCalibrationHistory(backendId);
  return (rows || []).map((r) => ({
    t: r.timestamp || r.calibration_timestamp,
    v: r[metricDef.field] ?? null,
  }));
}

function windowFilter(points, hours) {
  const cutoff = Date.now() - hours * 3.6e6;
  return points.filter((p) => {
    const ms = parseDate(p.t)?.getTime();
    return ms == null || ms >= cutoff;
  });
}

export const MetricsExplorer = () => {
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
  const [compareBackend, setCompareBackend] = useState('');
  const [metricId, setMetricId] = useState('pending_jobs');
  const [seriesA, setSeriesA] = useState([]);
  const [seriesB, setSeriesB] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [saved, setSaved] = useState([]);
  const [saveName, setSaveName] = useState('');
  const { setActions, clearActions } = usePageActions();

  const metricDef = useMemo(() => EXPLORER_METRICS.find((m) => m.id === metricId) || EXPLORER_METRICS[0], [metricId]);
  const selectedBackend = scopeBackend;

  const refreshSaved = useCallback(() => setSaved(listSavedQueries()), []);

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

  const loadSeries = useCallback(async () => {
    if (!selectedBackend) return;
    const limit = telemetryLimitForHours(windowHours);
    try {
      const [a, b] = await Promise.all([
        fetchMetricSeries(selectedBackend, metricDef, limit),
        compareBackend ? fetchMetricSeries(compareBackend, metricDef, limit) : Promise.resolve([]),
      ]);
      setSeriesA(a);
      setSeriesB(b);
      setLastRefresh(new Date());
    } catch {
      setSeriesA([]);
      setSeriesB([]);
    }
  }, [selectedBackend, compareBackend, metricDef, windowHours]);

  useEffect(() => { loadBackends(); refreshSaved(); }, [loadBackends, refreshSaved]);
  useEffect(() => { loadSeries(); }, [loadSeries]);

  useEffect(() => {
    setActions(
      <RefreshButton onClick={() => { loadBackends(); loadSeries(); }} lastRefreshAt={lastRefresh} label="Refresh metrics explorer" />,
    );
    return () => clearActions();
  }, [loadBackends, loadSeries, lastRefresh, setActions, clearActions]);

  const filteredA = useMemo(() => windowFilter(seriesA, windowHours), [seriesA, windowHours]);
  const filteredB = useMemo(() => windowFilter(seriesB, windowHours), [seriesB, windowHours]);

  const chartOption = useMemo(() => {
    const sem = getChartSemanticColors();
    const labels = filteredA.map((p) => formatISTChartTick(p.t, windowHours));
    const discrete = metricDef.id === 'pending_jobs' || metricDef.id === 'queued_jobs';
    const series = [
      {
        name: selectedBackend || 'Primary',
        type: 'line',
        smooth: false,
        step: discrete ? 'end' : false,
        data: filteredA.map((p) => (p.v != null && Number.isFinite(Number(p.v)) ? Number(p.v) : null)),
        connectNulls: false,
        itemStyle: { color: sem.healthy },
      },
    ];
    if (compareBackend && filteredB.length) {
      series.push({
        name: compareBackend,
        type: 'line',
        smooth: false,
        step: discrete ? 'end' : false,
        data: filteredB.map((p) => (p.v != null && Number.isFinite(Number(p.v)) ? Number(p.v) : null)),
        connectNulls: false,
        itemStyle: { color: sem.accent },
      });
    }
    return {
      backgroundColor: 'transparent',
      tooltip: baseTooltip(isDark),
      legend: compareBackend ? { bottom: 0, textStyle: { color: theme.textColor } } : undefined,
      grid: { left: '3%', right: '4%', bottom: compareBackend ? '14%' : '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: labels.length ? labels : filteredB.map((p) => formatISTTime(p.t, false)),
        axisLine: { lineStyle: { color: theme.axisLine } },
        axisLabel: { color: theme.textColor },
      },
      yAxis: {
        type: 'value',
        name: metricDef.label,
        axisLine: { lineStyle: { color: theme.axisLine } },
        splitLine: { lineStyle: { color: theme.splitColor } },
        axisLabel: { color: theme.textColor },
      },
      series,
    };
  }, [filteredA, filteredB, selectedBackend, compareBackend, isDark, theme, metricDef, windowHours]);

  const statsPrimary = useMemo(
    () => seriesStats(filteredA.map((p) => p.v)),
    [filteredA],
  );

  const applySaved = (q) => {
    if (!q) return;
    setMetricId(q.metricId);
    if (q.primaryBackend) setBackend(q.primaryBackend);
    setCompareBackend(q.compareBackend || '');
    if (q.hours) setWindowHours(q.hours);
  };

  const onSave = () => {
    if (!saveName.trim() || !selectedBackend) return;
    saveQuery({
      name: saveName.trim(),
      metricId,
      primaryBackend: selectedBackend,
      compareBackend,
      hours: windowHours,
    });
    setSaveName('');
    refreshSaved();
  };

  if (loading) return <BoneyardSkeleton layout="grid" />;
  if (!backends.length) {
    return (
      <div className="page-stack">
        <EmptyState variant="panel" title="No backends" message="Register QPUs before exploring metrics." />
      </div>
    );
  }

  const hasPoints = filteredA.length > 0 || filteredB.length > 0;
  const asOf = filteredA.length ? formatISTTime(filteredA[filteredA.length - 1].t) : null;

  return (
    <div className="page-stack" data-tour="page-metrics-explorer">
      <section className="card page-panel" aria-label="Metrics explorer query">
        <h3 className="page-section-title" style={{ marginTop: 0 }}>Query</h3>
        <div className="page-toolbar-unified" aria-label="Scope and metrics">
          <label className="outline-field">
            <span>Backend</span>
            <select className="input-control" value={selectedBackend || ''} onChange={(e) => setBackend(e.target.value)} aria-label="Backend scope">
              {backends.map((b) => (
                <option key={b.backend_id} value={b.backend_id}>{b.backend_name || b.backend_id}</option>
              ))}
            </select>
          </label>
          <label className="outline-field">
            <span>Lookback</span>
            <select className="input-control" value={windowHours} onChange={(e) => setWindowHours(Number(e.target.value))} aria-label="Lookback hours">
              {[6, 12, 24, 48, 168].map((h) => (
                <option key={h} value={h}>{h} h</option>
              ))}
            </select>
          </label>
          <label className="outline-field">
            <span>Metric</span>
            <select className="input-control" value={metricId} onChange={(e) => setMetricId(e.target.value)} aria-label="Metric">
              {EXPLORER_METRICS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="outline-field">
            <span>Compare backend</span>
            <select className="input-control" value={compareBackend} onChange={(e) => setCompareBackend(e.target.value)} aria-label="Compare backend">
              <option value="">None</option>
              {backends.filter((b) => b.backend_id !== selectedBackend).map((b) => (
                <option key={b.backend_id} value={b.backend_id}>{b.backend_name || b.backend_id}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card page-panel" aria-label="Saved queries">
        <h3 className="page-section-title" style={{ marginTop: 0 }}>Saved queries</h3>
        <div className="page-toolbar-unified">
          <label className="outline-field">
            <span>Saved queries</span>
            <select
              className="input-control"
              value=""
              aria-label="Saved queries"
              onChange={(e) => {
                const q = saved.find((s) => s.id === e.target.value);
                applySaved(q);
              }}
            >
              <option value="">Select saved query…</option>
              {saved.map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </label>
          <label className="outline-field">
            <span>Save as</span>
            <input className="input-control" placeholder="Required name" aria-label="Save query as" value={saveName} onChange={(e) => setSaveName(e.target.value)} required />
          </label>
          <div className="ops-filter__actions">
            <button type="button" className="btn btn-primary" disabled={!saveName.trim() || !selectedBackend} onClick={onSave}>Save query</button>
          </div>
        </div>
      </section>

      {statsPrimary && (
        <p className="page-hint" style={{ margin: 0 }}>
          {filteredA.length} sample{filteredA.length === 1 ? '' : 's'} in {windowHours} h window
          {statsPrimary ? ` · min ${statsPrimary.min.toFixed(2)} · max ${statsPrimary.max.toFixed(2)} · mean ${statsPrimary.mean.toFixed(2)}` : ''}
          {asOf ? ` · latest ${asOf}` : ''}
        </p>
      )}

      <ChartPanel
        title={`${metricDef.label}${compareBackend ? ' · compare' : ''}`}
        titleTo={selectedBackend ? `/app/resources/health?backend=${encodeURIComponent(selectedBackend)}` : '/app/resources/health'}
        sourceKind="cached"
        asOf={asOf}
        state={hasPoints ? 'ready' : 'empty'}
        emptyTitle="No samples"
        emptyMessage="Choose another metric or widen the time window."
        minHeight={400}
      >
        <QtECharts option={chartOption} style={{ height: 400 }} />
      </ChartPanel>
    </div>
  );
};
