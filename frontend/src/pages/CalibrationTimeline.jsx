import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { api } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { formatISTTime } from '../utils/time';
import { readTelemetryWindowHours, telemetryLimitForHours, writeTelemetryWindowHours } from '../utils/telemetryWindow';
import { ContextBar } from '../components/observability/ContextBar.jsx';
import { useAppScope } from '../hooks/useAppScope.js';
import { useTheme } from '../components/ui/ThemeProvider';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { baseTooltip, getChartTheme, getChartSemanticColors } from '../components/observability/chartTheme.js';
import { buildBackendDetailsPath, buildDriftInvestigationLocation } from '../lib/investigationLinks.js';
import { modalityOf } from './telemetryPageUtils.js';
import { DataPanelToolbar } from '../components/observability/DataViewToolbar.jsx';
import './CalibrationTimeline.css';
import './TelemetryPages.css';

export const CalibrationTimeline = () => {
  const navigate = useNavigate();
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const theme = getChartTheme(isDark);

  const { backend: backendId, hours: windowHours, setBackend, setHours: setScopeHours } = useAppScope({
    defaultHours: readTelemetryWindowHours(),
  });
  const setWindowHours = (h) => {
    writeTelemetryWindowHours(h);
    setScopeHours(h);
  };
  const [backends, setBackends] = useState([]);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [layout, setLayout] = useState('table');
  const [eventPage, setEventPage] = useState(0);
  const EVENT_PAGE_SIZE = 25;
  const { setActions, clearActions } = usePageActions();

  useEffect(() => {
    api.getBackends().then((b) => {
      const list = b || [];
      setBackends(list);
      if (!list.length) return;
      const valid = backendId && list.some((x) => x.backend_id === backendId);
      if (!valid) setBackend(list[0].backend_id);
    });
  }, [backendId, setBackend]);

  const loadTimeline = useCallback(() => {
    if (!backendId) return;
    setLoading(true);
    api.getCalibrationTimeline(backendId, telemetryLimitForHours(windowHours))
      .then((p) => {
        setPayload(p);
        setLastRefresh(new Date());
      })
      .catch(() => setPayload(null))
      .finally(() => setLoading(false));
  }, [backendId, windowHours]);

  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  useEffect(() => {
    setEventPage(0);
  }, [backendId, windowHours, payload?.calibration_events?.length]);

  useEffect(() => {
    setActions(<RefreshButton onClick={loadTimeline} lastRefreshAt={lastRefresh} label="Refresh cal timeline" />);
    return () => clearActions();
  }, [loadTimeline, lastRefresh, setActions, clearActions]);

  const option = useMemo(() => {
    const sem = getChartSemanticColors();
    const cutoff = Date.now() - windowHours * 3.6e6;
    const inWindow = (ts) => {
      if (!ts) return false;
      const ms = new Date(ts).getTime();
      return Number.isFinite(ms) && ms >= cutoff;
    };
    const series = (payload?.t1_mean_series || []).filter((p) => inWindow(p.observed_at));
    const events = (payload?.calibration_events || []).filter((e) => inWindow(e.calibration_timestamp));
    if (!series.length && !events.length) return null;

    const xData = series.map((p) => formatISTTime(p.observed_at, false));
    const yData = series.map((p) => p.t1_mean_us);

    const markLines = events
      .filter((e) => e.calibration_timestamp)
      .map((e) => ({
        xAxis: formatISTTime(e.calibration_timestamp, false),
        label: { formatter: 'cal', fontSize: 9 },
        lineStyle: { color: sem.info, type: 'dashed' },
      }));

    return {
      backgroundColor: 'transparent',
      tooltip: baseTooltip(isDark),
      grid: { left: 48, right: 16, top: 24, bottom: 32 },
      xAxis: {
        type: 'category',
        data: xData,
        axisLine: { lineStyle: { color: theme.axisLine } },
        axisLabel: { fontSize: 10, rotate: 30, color: theme.textColor },
      },
      yAxis: {
        type: 'value',
        name: 'Mean T1 (µs)',
        nameTextStyle: { fontSize: 11, color: theme.textColor },
        axisLine: { lineStyle: { color: theme.axisLine } },
        splitLine: { lineStyle: { color: theme.splitColor } },
        axisLabel: { color: theme.textColor },
      },
      series: [{
        name: 'Mean T1',
        type: 'line',
        data: yData,
        smooth: true,
        itemStyle: { color: sem.accent },
        markLine: markLines.length ? { symbol: 'none', data: markLines } : undefined,
      }],
    };
  }, [payload, isDark, theme, windowHours]);

  if (loading && !payload) return <BoneyardSkeleton layout="grid" />;

  return (
    <div className="page-stack">
      <ContextBar
        backend={backendId}
        backends={backends}
        onBackendChange={setBackend}
        hours={windowHours}
        onHoursChange={setWindowHours}
        showTimeRange
        timeRangeAffectsQuery
      />

      <ChartPanel
        title="Mean T1 with calibration markers"
        sourceKind="cached"
        state={option ? 'ready' : 'empty'}
        emptyTitle="Insufficient history"
        emptyMessage="Expand lookback or wait for more qubit telemetry samples."
        minHeight={380}
        tableAlternative={option ? undefined : (
          <p className="page-hint">No T1 mean series or calibration markers in this window.</p>
        )}
      >
        {option && <QtECharts option={option} style={{ height: 'min(420px, 50vh)', minHeight: 320, width: '100%' }} />}
      </ChartPanel>

      {backendId && modalityOf(backends, backendId) === 'trapped_ion' && (
        <p className="tm-callout">Trapped-ion mean T1 uses a different scale (µs) than superconducting backends — compare within modality only.</p>
      )}

      {backendId && (
        <p className="link-row" style={{ margin: 0 }}>
          <button type="button" className="fs-link" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }} onClick={() => navigate(buildBackendDetailsPath(backendId, 'calibration'))}>Calibration workspace</button>
        </p>
      )}

      {(payload?.calibration_events || []).length > 0 && (() => {
        const events = payload.calibration_events || [];
        const totalPages = Math.max(1, Math.ceil(events.length / EVENT_PAGE_SIZE));
        const page = Math.min(eventPage, totalPages - 1);
        const slice = events.slice(page * EVENT_PAGE_SIZE, page * EVENT_PAGE_SIZE + EVENT_PAGE_SIZE);
        return (
        <div className="card page-panel dvt-panel">
          <DataPanelToolbar
            title={`Calibration events (${events.length})`}
            layout={layout}
            onLayoutChange={setLayout}
            countLabel={`${events.length} events · page ${page + 1}/${totalPages}`}
          />
          {layout === 'grid' ? (
            <div className="dvt-grid">
              {slice.map((e, i) => (
                <article key={`${e.calibration_timestamp}-${i}`} className="dvt-card">
                  <h4 className="dvt-card__title">{e.calibration_timestamp ? formatISTTime(e.calibration_timestamp) : 'N/A'}</h4>
                  <p className="dvt-card__meta">{e.calibration_identifier || 'N/A'}</p>
                  <p className="dvt-card__body">Freshness: {e.freshness_status || 'N/A'}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="custom-table custom-table--dense">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Identifier</th>
                    <th>Freshness</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((e, i) => (
                    <tr key={`${e.calibration_timestamp}-${i}`}>
                      <td>{e.calibration_timestamp ? formatISTTime(e.calibration_timestamp) : '—'}</td>
                      <td>{e.calibration_identifier || '—'}</td>
                      <td>{e.freshness_status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="link-row" style={{ padding: '12px 16px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary btn--xs" disabled={page <= 0} onClick={() => setEventPage((p) => Math.max(0, p - 1))}>Previous</button>
            <span className="page-hint" style={{ margin: 0 }}>{page + 1} / {totalPages}</span>
            <button type="button" className="btn btn-secondary btn--xs" disabled={page >= totalPages - 1} onClick={() => setEventPage((p) => Math.min(totalPages - 1, p + 1))}>Next</button>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
