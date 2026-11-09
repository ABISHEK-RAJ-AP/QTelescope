import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { api } from '../services/api';
import { formatISTTime } from '../utils/time';
import { parseDate } from '../utils/time';
import { useTheme } from '../components/ui/ThemeProvider';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { ContextBar } from '../components/observability/ContextBar.jsx';
import { useAppScope } from '../hooks/useAppScope.js';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { baseTooltip, getChartTheme } from '../components/observability/chartTheme.js';
import { readTelemetryWindowHours, writeTelemetryWindowHours } from '../utils/telemetryWindow';
import {
  EXPLORER_METRICS,
  deleteSavedQuery,
  listSavedQueries,
  saveQuery,
} from '../lib/metricsExplorerQueries.js';
import './TelemetryPages.css';

async function fetchMetricSeries(backendId, metricDef) {
  if (!backendId || !metricDef) return [];
  if (metricDef.source === 'telemetry') {
    const rows = await api.getBackendTelemetry(backendId);
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
    try {
      const [a, b] = await Promise.all([
        fetchMetricSeries(selectedBackend, metricDef),
        compareBackend ? fetchMetricSeries(compareBackend, metricDef) : Promise.resolve([]),
      ]);
      setSeriesA(a);
      setSeriesB(b);
      setLastRefresh(new Date());
    } catch {
      setSeriesA([]);
      setSeriesB([]);
    }
  }, [selectedBackend, compareBackend, metricDef]);

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
    const labels = filteredA.map((p) => formatISTTime(p.t, false));
    const series = [
      {
        name: selectedBackend || 'Primary',
        type: 'line',
        smooth: true,
        data: filteredA.map((p) => (p.v != null && Number.isFinite(Number(p.v)) ? Number(p.v) : null)),
        connectNulls: false,
        itemStyle: { color: '#059669' },
      },
    ];
    if (compareBackend && filteredB.length) {
      series.push({
        name: compareBackend,
        type: 'line',
        smooth: true,
        data: filteredB.map((p) => (p.v != null && Number.isFinite(Number(p.v)) ? Number(p.v) : null)),
        connectNulls: false,
        itemStyle: { color: '#0284c7' },
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
  }, [filteredA, filteredB, selectedBackend, compareBackend, isDark, theme, metricDef]);

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
      <ContextBar
        backend={selectedBackend}
        backends={backends}
        onBackendChange={setBackend}
        hours={windowHours}
        onHoursChange={setWindowHours}
        showTimeRange
        timeRangeAffectsQuery
      />

      <section className="card page-panel" aria-label="Metrics explorer controls">
        <div className="admin-actions" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <label className="admin-form-field">
            <span className="admin-form-label">Metric</span>
            <select className="input-control" value={metricId} onChange={(e) => setMetricId(e.target.value)}>
              {EXPLORER_METRICS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="admin-form-field">
            <span className="admin-form-label">Compare backend</span>
            <select className="input-control" value={compareBackend} onChange={(e) => setCompareBackend(e.target.value)}>
              <option value="">None</option>
              {backends.filter((b) => b.backend_id !== selectedBackend).map((b) => (
                <option key={b.backend_id} value={b.backend_id}>{b.backend_name || b.backend_id}</option>
              ))}
            </select>
          </label>
          <label className="admin-form-field">
            <span className="admin-form-label">Saved queries</span>
            <select
              className="input-control"
              value=""
              onChange={(e) => {
                const q = saved.find((s) => s.id === e.target.value);
                applySaved(q);
              }}
            >
              <option value="">Load saved…</option>
              {saved.map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </label>
          <label className="admin-form-field" style={{ minWidth: 160 }}>
            <span className="admin-form-label">Save as</span>
            <input className="input-control" placeholder="Query name" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary btn--xs" disabled={!saveName.trim()} onClick={onSave}>Save query</button>
          {saved.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn--xs"
              onClick={() => {
                const first = saved[0];
                if (first) {
                  deleteSavedQuery(first.id);
                  refreshSaved();
                }
              }}
            >
              Delete latest
            </button>
          )}
        </div>
        <p className="page-hint" style={{ marginTop: 8 }}>
          Source: {metricDef.source === 'telemetry' ? 'stored backend telemetry' : 'calibration snapshots'} · window applies client-side.
        </p>
      </section>

      <ChartPanel
        title={`${metricDef.label}${compareBackend ? ' · compare' : ''}`}
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
