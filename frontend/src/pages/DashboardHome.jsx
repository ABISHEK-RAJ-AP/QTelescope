import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { ChevronRight } from 'lucide-react';
import { notifyError, notifyWarn } from '../lib/toast.js';
import { api } from '../services/api';
import { formatISTTime } from '../utils/time';
import { useTheme } from '../components/ui/ThemeProvider';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { ExceptionStrip } from '../components/observability/ExceptionStrip.jsx';
import { AnimatedNumber } from '../components/ui/AnimatedNumber.jsx';
import {
  getChartTheme, baseTooltip, getChartSemanticColors, getFleetStateChartColors,
} from '../components/observability/chartTheme.js';
import { buildBackendDetailsLocation } from '../lib/investigationLinks.js';
import { WIDGET_IDS, readDashboardWidgets } from '../utils/dashboardPreferences.js';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { LayoutCustomizeToggle } from '../components/settings/LayoutCustomizeToggle.jsx';
import { DashboardBentoGrid } from '../components/dashboard/DashboardBentoGrid.jsx';
import { usePageLayout } from '../hooks/usePageLayout.js';
import { buildBackendDetailsPath, buildTimelineInvestigationLocation } from '../lib/investigationLinks.js';
import { STALE_MIN, ageMinutes, groupTimeline, lineageByProvider, sevBadge } from './fleetData.js';
import { StateBar } from './fleetShared.jsx';
import { unableToLoad } from '../constants/messages.js';
import './DashboardHome.css';

const HEALTH_PATH = '/app/resources/health';
const STATES = ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'];
const shortName = (n) => String(n || '').replace(/ \(\d+Q\)/, '').replace('-64', '');
const fmtUs = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} s`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} ms`;
  return `${n.toFixed(1)} µs`;
};

/** Widgets that still exist. Others from saved layouts are dropped (redundant/decorative). */
const ACTIVE = [
  WIDGET_IDS.exceptions, WIDGET_IDS.fleetSummary, WIDGET_IDS.alertQueue,
  WIDGET_IDS.calChart, WIDGET_IDS.coherenceChart,
  WIDGET_IDS.fleetTrend, WIDGET_IDS.modalityStrip, WIDGET_IDS.platformPanel,
  WIDGET_IDS.opsTimeline,
];
const PLACEMENT = {
  [WIDGET_IDS.exceptions]: 'top',
  /* Full-width platform band — avoids orphan empty column in 2-col grid */
  [WIDGET_IDS.platformPanel]: 'mid',
  [WIDGET_IDS.opsTimeline]: 'bottom',
  [WIDGET_IDS.fleetSummary]: 'bottom',
};
const SOURCES = ['backends', 'alertsSummary', 'queues', 'calibrations', 'coherence', 'platform', 'health', 'centre', 'timeline'];
const PRIMARY_SOURCES = ['backends', 'alertsSummary', 'health', 'centre'];
const SECONDARY_SOURCES = ['queues', 'calibrations', 'coherence', 'platform', 'timeline'];
const CHART_WIDGETS = new Set([
  WIDGET_IDS.queueChart, WIDGET_IDS.calChart, WIDGET_IDS.coherenceChart,
  WIDGET_IDS.fleetTrend, WIDGET_IDS.modalityStrip, WIDGET_IDS.platformPanel,
]);

function DashboardHomeInner() {
  const { resolved } = useTheme();
  const theme = getChartTheme(resolved === 'dark');
  const navigate = useNavigate();
  const { setActions, clearActions } = usePageActions();
  const [widgetVisibility] = useState(() => readDashboardWidgets());
  const {
    layout, customizing, setCustomizing, persistOrder, setWidgetSpan, resetLayout, applySmart, layoutSuggestions,
  } = usePageLayout('dashboard');

  const [d, setD] = useState({});
  const [failed, setFailed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartsReady, setChartsReady] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const apiCalls = useCallback(() => ({
    backends: api.getBackends(),
    alertsSummary: api.getAlertsSummary(),
    queues: api.getQueues(),
    calibrations: api.getCalibrations(),
    coherence: api.getCoherence(),
    platform: api.getPlatformHealth(),
    health: api.getHealthVector(),
    centre: api.getOperationsCentre(),
    timeline: api.getOpsTimeline(60),
  }), []);

  const mergeKeys = useCallback((keys, res) => {
    const bad = [];
    setD((prev) => {
      const next = { ...prev };
      res.forEach((r, i) => {
        const k = keys[i];
        if (r.status === 'fulfilled') next[k] = r.value;
        else bad.push(k);
      });
      return next;
    });
    setFailed((prev) => [...new Set([...prev.filter((x) => !keys.includes(x)), ...bad])]);
    if (res.some((r) => r.status === 'fulfilled')) setLastRefresh(new Date());
  }, []);

  const fetchKeys = useCallback(async (keys) => {
    const calls = apiCalls();
    return Promise.allSettled(keys.map((k) => calls[k]));
  }, [apiCalls]);

  const loadSecondary = useCallback(() => {
    fetchKeys(SECONDARY_SOURCES).then((res) => mergeKeys(SECONDARY_SOURCES, res));
  }, [fetchKeys, mergeKeys]);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      const res = await fetchKeys(SOURCES);
      mergeKeys(SOURCES, res);
      return;
    }
    setLoading(true);
    const res = await fetchKeys(PRIMARY_SOURCES);
    mergeKeys(PRIMARY_SOURCES, res);
    setLoading(false);
    const run = () => loadSecondary();
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 1200 });
    else setTimeout(run, 32);
  }, [fetchKeys, mergeKeys, loadSecondary]);

  useEffect(() => {
    loadData();
    const t = setInterval(() => { if (!document.hidden) loadData({ silent: true }); }, 30000);
    return () => clearInterval(t);
  }, [loadData]);

  useEffect(() => {
    if (loading) {
      setChartsReady(false);
      return undefined;
    }
    const id = typeof requestIdleCallback === 'function'
      ? requestIdleCallback(() => setChartsReady(true), { timeout: 600 })
      : setTimeout(() => setChartsReady(true), 80);
    return () => {
      if (typeof id === 'number') clearTimeout(id);
      else cancelIdleCallback(id);
    };
  }, [loading]);

  useEffect(() => {
    setActions(
      <div className="dashboard-header__actions">
        <LayoutCustomizeToggle
          customizing={customizing}
          onToggle={() => setCustomizing((v) => !v)}
          onReset={resetLayout}
          onSmartLayout={applySmart}
          smartLayoutHint={layoutSuggestions[0]?.reason ? `Suggested layout: ${layoutSuggestions[0].reason}` : undefined}
          label="Customize"
        />
        <RefreshButton onClick={() => loadData({ silent: true })} lastRefreshAt={lastRefresh} label="Refresh dashboard" />
      </div>,
    );
    return () => clearActions();
  }, [customizing, resetLayout, applySmart, layoutSuggestions, lastRefresh, loadData, setActions, clearActions, setCustomizing]);

  const alertSummary = d.alertsSummary;
  const providers = useMemo(() => d.centre?.collectors?.providers || d.platform?.collectors?.providers || [], [d.centre, d.platform]);
  const lineage = useMemo(() => lineageByProvider(providers), [providers]);

  const rows = useMemo(() => {
    const byId = new Map();
    (d.backends || []).forEach((b) => byId.set(b.backend_id, { ...b }));
    (d.health?.backends || []).forEach((h) => byId.set(h.backend_id, { ...(byId.get(h.backend_id) || {}), ...h }));
    return [...byId.values()].map((b) => {
      const q = (d.queues || []).find((x) => x.backend_id === b.backend_id);
      const cal = (d.calibrations || []).find((x) => x.backend_id === b.backend_id);
      const crit = alertSummary?.critical_by_backend?.[b.backend_id] ?? 0;
      const warn = alertSummary?.warning_by_backend?.[b.backend_id] ?? 0;
      return {
        ...b,
        lineage: lineage[b.provider_id] || (providers.length ? 'unknown' : null),
        pending: q?.pending_jobs,
        calFresh: cal?.freshness_status,
        crit,
        warn,
      };
    }).sort((a, b) => {
      const rank = { RED: 0, YELLOW: 1, UNKNOWN: 2, GREEN: 3 };
      return (rank[a.router] ?? 2) - (rank[b.router] ?? 2) || b.crit - a.crit;
    });
  }, [d.backends, d.health, d.queues, d.calibrations, alertSummary, lineage, providers.length]);

  const crit = alertSummary?.critical ?? 0;
  const warn = alertSummary?.warning ?? 0;
  const total = alertSummary?.active ?? d.centre?.operations?.active_alerts ?? crit + warn;
  const other = Math.max(0, total - crit - warn);
  const collectorBad = providers.filter((p) => {
    const age = ageMinutes(p.last_success_at);
    return p.status !== 'OK' || (age != null && age > STALE_MIN);
  }).length;

  const cohRows = useMemo(
    () => (d.coherence?.backends || []).filter((c) => Number(c.t1_mean) > 0)
      .sort((a, b) => String(a.qpu_modality).localeCompare(String(b.qpu_modality)) || a.t1_mean - b.t1_mean),
    [d.coherence],
  );
  const t1Crit = d.health?.t1_crit_us;
  const cohOption = useMemo(() => {
    const sem = getChartSemanticColors();
    const names = cohRows.map((c) => `${shortName(c.backend_name)} (${c.qpu_modality})`);
    const opt = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: theme.tooltipBg,
        borderColor: theme.tooltipBorder, textStyle: { color: theme.tooltipText },
        formatter: (p) => {
          const c = cohRows[p?.[0]?.dataIndex];
          return c ? `${shortName(c.backend_name)}<br/>T1 mean ${fmtUs(c.t1_mean)} · worst qubit ${fmtUs(c.t1_min)}<br/>${c.n} qubits` : '';
        },
      },
      legend: { top: 0, textStyle: { color: theme.textColor, fontSize: 11 } },
      grid: { top: 30, left: 8, right: 24, bottom: 8, containLabel: true },
      yAxis: { type: 'category', data: names, axisLabel: { color: theme.textColor, fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
      xAxis: {
        type: 'log', min: 1, name: 'T1 (µs, log)', nameTextStyle: { color: theme.textColor, fontSize: 10 },
        axisLabel: { color: theme.textColor, fontSize: 10 }, splitLine: { lineStyle: { color: theme.splitColor, type: 'dashed' } },
      },
      series: [
        {
          name: 'T1 mean', type: 'bar', barMaxWidth: 14, itemStyle: { color: sem.accent, borderRadius: [0, 3, 3, 0] },
          data: cohRows.map((c) => c.t1_mean),
          markLine: t1Crit ? {
            symbol: 'none', lineStyle: { color: sem.critical, type: 'dashed' },
            label: { formatter: `T1 floor ${t1Crit} µs`, color: theme.textColor, fontSize: 10 },
            data: [{ xAxis: t1Crit }],
          } : undefined,
        },
        {
          name: 'Worst qubit T1', type: 'scatter', symbol: 'diamond', symbolSize: 10,
          itemStyle: { color: sem.critical }, data: cohRows.map((c) => c.t1_min),
        },
      ],
    };
    return opt;
  }, [cohRows, theme, t1Crit, resolved]);

  const queueRows = useMemo(
    () => (d.queues || []).slice().sort((a, b) => (Number(b.pending_jobs) || 0) - (Number(a.pending_jobs) || 0)),
    [d.queues],
  );
  const queueOption = useMemo(() => {
    const sem = getChartSemanticColors();
    return {
      backgroundColor: 'transparent',
      tooltip: baseTooltip(resolved === 'dark'),
      xAxis: { type: 'category', data: queueRows.map((q) => shortName(rows.find((r) => r.backend_id === q.backend_id)?.backend_name || q.backend_id)), axisLabel: { color: theme.textColor, rotate: 24, fontSize: 10 }, axisLine: { lineStyle: { color: theme.axisLine } } },
      yAxis: { type: 'value', name: 'pending', nameTextStyle: { color: theme.textColor }, axisLabel: { color: theme.textColor }, splitLine: { lineStyle: { color: theme.splitColor } } },
      series: [{ type: 'bar', barMaxWidth: 28, data: queueRows.map((q) => q.pending_jobs ?? null), itemStyle: { color: sem.accent, borderRadius: [4, 4, 0, 0] } }],
    };
  }, [queueRows, rows, theme, resolved]);

  const calRows = useMemo(
    () => (d.calibrations || []).slice().filter((c) => c.calibration_age != null).sort((a, b) => Number(b.calibration_age) - Number(a.calibration_age)),
    [d.calibrations],
  );
  const calOption = useMemo(() => {
    const sem = getChartSemanticColors();
    return {
      backgroundColor: 'transparent',
      tooltip: baseTooltip(resolved === 'dark'),
      xAxis: { type: 'category', data: calRows.map((c) => shortName(c.backend_name || c.backend_id)), axisLabel: { color: theme.textColor, rotate: 24, fontSize: 10 }, axisLine: { lineStyle: { color: theme.axisLine } } },
      yAxis: { type: 'value', name: 'hours', nameTextStyle: { color: theme.textColor }, axisLabel: { color: theme.textColor }, splitLine: { lineStyle: { color: theme.splitColor } } },
      series: [{ type: 'bar', barMaxWidth: 28, data: calRows.map((c) => Number(c.calibration_age)), itemStyle: { color: sem.info, borderRadius: [4, 4, 0, 0] } }],
    };
  }, [calRows, theme, resolved]);

  const fleetStateTotals = useMemo(() => {
    const t = { GREEN: 0, YELLOW: 0, RED: 0, UNKNOWN: 0 };
    rows.forEach((r) => STATES.forEach((s) => { t[s] += r.counts?.[s] || 0; }));
    return t;
  }, [rows]);
  const STATE_COLORS = getFleetStateChartColors();
  const qubitTotal = fleetStateTotals.GREEN + fleetStateTotals.YELLOW + fleetStateTotals.RED + fleetStateTotals.UNKNOWN;
  const greenPct = qubitTotal ? Math.round((100 * fleetStateTotals.GREEN) / qubitTotal) : null;
  const totalPending = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.pending) || 0), 0),
    [rows],
  );
  const calStale = useMemo(
    () => (d.calibrations || []).filter((c) => {
      const status = String(c.freshness_status || '').toLowerCase();
      if (status === 'stale') return true;
      const age = Number(c.calibration_age);
      return Number.isFinite(age) && age >= 24;
    }).length,
    [d.calibrations],
  );
  /** Actionable: where alert load concentrates (replaces weak state-mix pie). */
  const alertPressureRows = useMemo(
    () => rows
      .map((r) => ({ id: r.backend_id, name: shortName(r.backend_name || r.backend_id), crit: r.crit, warn: r.warn, total: r.crit + r.warn }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total || b.crit - a.crit)
      .slice(0, 8),
    [rows],
  );
  const alertPressureOption = useMemo(() => {
    const sem = getChartSemanticColors();
    return {
      backgroundColor: 'transparent',
      tooltip: baseTooltip(resolved === 'dark'),
      legend: { top: 0, textStyle: { color: theme.textColor, fontSize: 11 } },
      grid: { top: 28, left: 8, right: 16, bottom: 8, containLabel: true },
      yAxis: {
        type: 'category',
        data: alertPressureRows.map((r) => r.name).reverse(),
        axisLabel: { color: theme.textColor, fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      xAxis: {
        type: 'value',
        name: 'active',
        nameTextStyle: { color: theme.textColor, fontSize: 10 },
        axisLabel: { color: theme.textColor },
        splitLine: { lineStyle: { color: theme.splitColor, type: 'dashed' } },
      },
      series: [
        {
          name: 'Critical', type: 'bar', stack: 'a', barMaxWidth: 16,
          data: alertPressureRows.map((r) => r.crit).reverse(),
          itemStyle: { color: sem.critical, borderRadius: [0, 0, 0, 0] },
        },
        {
          name: 'Warning', type: 'bar', stack: 'a', barMaxWidth: 16,
          data: alertPressureRows.map((r) => r.warn).reverse(),
          itemStyle: { color: sem.warn, borderRadius: [0, 3, 3, 0] },
        },
      ],
    };
  }, [alertPressureRows, theme, resolved]);

  const workloadScatter = useMemo(() => rows.map((r) => {
    const qs = r.qubits || [];
    const t1s = qs.map((q) => q.t1).filter((v) => v != null && Number.isFinite(Number(v)));
    const meanT1 = t1s.length ? t1s.reduce((a, b) => a + Number(b), 0) / t1s.length : null;
    return { id: r.backend_id, name: r.backend_name, modality: r.qpu_modality, pending: r.pending, meanT1 };
  }).filter((r) => r.meanT1 != null && r.pending != null), [rows]);

  const workloadOption = useMemo(() => {
    const sem = getChartSemanticColors();
    return {
      backgroundColor: 'transparent',
      tooltip: {
        ...baseTooltip(resolved === 'dark'), trigger: 'item',
        formatter: (p) => `${p.data.name}<br/>pending ${p.data.pending}<br/>mean T1 ${fmtUs(p.data.meanT1)}<br/>${p.data.modality || ''}`,
      },
      xAxis: { type: 'log', name: 'mean T1 µs', nameTextStyle: { color: theme.textColor }, axisLabel: { color: theme.textColor }, splitLine: { lineStyle: { color: theme.splitColor } } },
      yAxis: { type: 'value', name: 'pending jobs', nameTextStyle: { color: theme.textColor }, axisLabel: { color: theme.textColor }, splitLine: { lineStyle: { color: theme.splitColor } } },
      series: [{
        type: 'scatter', symbolSize: 14,
        data: workloadScatter.map((r) => ({ value: [r.meanT1, r.pending], name: shortName(r.name || r.id), id: r.id, pending: r.pending, meanT1: r.meanT1, modality: r.modality })),
        itemStyle: { color: sem.healthy, opacity: 0.85 },
      }],
    };
  }, [workloadScatter, theme, resolved]);

  const routerStackOption = useMemo(() => {
    const top = rows.slice(0, 8);
    return {
      backgroundColor: 'transparent',
      tooltip: baseTooltip(resolved === 'dark'),
      legend: { top: 0, textStyle: { color: theme.textColor, fontSize: 11 } },
      xAxis: { type: 'category', data: top.map((r) => shortName(r.backend_name || r.backend_id)), axisLabel: { color: theme.textColor, rotate: 20, fontSize: 10 }, axisLine: { lineStyle: { color: theme.axisLine } } },
      yAxis: { type: 'value', name: 'qubits', axisLabel: { color: theme.textColor }, splitLine: { lineStyle: { color: theme.splitColor } } },
      series: ['GREEN', 'YELLOW', 'RED'].map((s) => ({
        name: s, type: 'bar', stack: 'health', barMaxWidth: 32,
        data: top.map((r) => r.counts?.[s] || 0),
        itemStyle: { color: STATE_COLORS[s] },
      })),
    };
  }, [rows, theme, resolved]);

  const events = useMemo(() => {
    const ev = d.timeline?.events || (Array.isArray(d.timeline) ? d.timeline : []);
    return groupTimeline(ev).slice(0, 7);
  }, [d.timeline]);

  const latestTelemetry = d.platform?.latest_backend_telemetry_at;

  const go = (path) => () => navigate(path);
  const renderWidget = useCallback((id) => {
    if (CHART_WIDGETS.has(id) && !chartsReady) {
      return <div className="card fo-panel" style={{ minHeight: 280 }} aria-hidden><BoneyardSkeleton layout="grid" /></div>;
    }
    switch (id) {
      case WIDGET_IDS.exceptions: {
        const openInc = d.centre?.operations?.open_incidents;
        const activeAlerts = (Number(crit) || 0) + (Number(warn) || 0);
        const kpis = [
          {
            id: 'alerts', label: 'Active alerts', value: activeAlerts,
            sub: crit ? `${crit} critical · ${warn} warning` : (warn ? `${warn} warning` : 'None open'),
            tone: crit > 0 ? 'critical' : warn > 0 ? 'warn' : 'ok',
            onClick: go('/app/alerts'),
            help: 'CRITICAL + WARNING still ACTIVE. Open Alerts to acknowledge or resolve.',
          },
          {
            id: 'inc', label: 'Open incidents', value: openInc ?? '—',
            sub: openInc ? 'Triage required' : 'None open',
            tone: openInc > 0 ? 'warn' : 'ok',
            onClick: go('/app/alerts/incidents'),
            help: 'Incidents in Open, Acknowledged, or Investigating.',
          },
          {
            id: 'q', label: 'Pending jobs', value: totalPending,
            sub: rows.length ? `${rows.length} backends` : 'No queue data',
            tone: totalPending > 20 ? 'warn' : 'ok',
            onClick: go('/app/execution/queues'),
            help: 'Sum of pending_jobs across discovered backends.',
          },
          {
            id: 'cal', label: 'Calibrations ≥24h', value: calStale,
            sub: collectorBad ? `${collectorBad} collector(s) stale` : (greenPct != null ? `${greenPct}% qubits GREEN` : 'Age from last snapshot'),
            tone: calStale > 0 || collectorBad > 0 ? 'warn' : 'ok',
            onClick: go(collectorBad ? '/app/platform/health' : '/app/telemetry/calibration'),
            help: 'Backends whose last calibration is stale or older than 24 hours. Subline flags stale collectors.',
          },
        ];
        return (
          <section className="card fo-shift" aria-label="Shift snapshot">
            <ExceptionStrip data-tour="page-kpis" ariaLabel="Shift exceptions" className="fo-shift__kpis" items={kpis} />
            <div className="fo-shift__charts fo-shift__charts--single" data-tour="page-charts">
              <ChartPanel
                title="Queue depth"
                question="Pending jobs per backend — click a bar to open that machine."
                help="Fleet G/Y/R breakdown is in the backends table below; qubit rows live on Health vector."
                sourceKind="stored"
                state={queueRows.length ? 'ready' : 'empty'}
                emptyMessage="No queue samples."
                minHeight={240}
                actions={<Link className="fs-link" to="/app/execution/queues">Queues</Link>}
              >
                <QtECharts
                  option={queueOption}
                  style={{ height: 220, width: '100%' }}
                  onEvents={{ click: (p) => { const q = queueRows[p.dataIndex]; if (q?.backend_id) navigate(`/app/execution/queues?backend=${encodeURIComponent(q.backend_id)}`); } }}
                />
              </ChartPanel>
            </div>
          </section>
        );
      }
      case WIDGET_IDS.fleetSummary:
        return (
          <section className="card fo-panel fo-panel--fleet" aria-labelledby="fo-health-h">
            <div className="fo-panel__head">
              <div>
                <h2 id="fo-health-h" className="fo-panel__title">Fleet backends</h2>
                <p className="fo-panel__sub">Severity-ranked summary — open Health for qubit detail.</p>
              </div>
              <Link className="fs-link" to={HEALTH_PATH}>Qubit-level health <ChevronRight size={12} aria-hidden /></Link>
            </div>
            {rows.length === 0 ? (
              <EmptyState compact variant="panel" title="No backends" message="The registry and health vector returned no rows." />
            ) : (
              <div className="fo-table fo-table--compact" role="table" aria-label="Per-backend health">
                <div className="fo-row fo-row--compact fo-row--head" role="row">
                  <span role="columnheader">Backend</span>
                  <span role="columnheader">States</span>
                  <span role="columnheader">Advisory</span>
                  <span role="columnheader">Alerts</span>
                  <span role="columnheader"><span className="fs-sr">Open</span></span>
                </div>
                {rows.map((r) => (
                  <div key={r.backend_id} className="fo-row fo-row--compact" role="row">
                    <div role="cell" className="fo-cell-name">
                      <Link className="fo-name" to={buildBackendDetailsPath(r.backend_id)}>{r.backend_name || r.backend_id}</Link>
                      <div className="fo-meta">{r.qpu_modality || '—'} · cal {r.calFresh || '—'} · {r.pending ?? '—'} queued</div>
                    </div>
                    <div role="cell"><StateBar counts={r.counts} /></div>
                    <div role="cell" className="fo-adv">
                      <strong>{r.router || 'UNKNOWN'}</strong>
                      <span className="fs-muted">{(r.recommended_action || '—').replace(/_/g, ' ')}</span>
                    </div>
                    <div role="cell" className="fo-alerts">
                      <span>{r.crit} crit</span>
                      <span className="fs-muted">{r.warn} warn</span>
                    </div>
                    <div role="cell" className="fo-actions">
                      <Link className="qts-bean qts-bean--emphasis" to={`${HEALTH_PATH}?backend=${encodeURIComponent(r.backend_id)}`}>Health</Link>
                      <Link className="qts-bean" to={buildBackendDetailsLocation(r.backend_id)}>Details</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      case WIDGET_IDS.alertQueue:
        return (
          <section className="card fo-panel" aria-labelledby="fo-alert-h">
            <div className="fo-panel__head">
              <div>
                <h2 id="fo-alert-h" className="fo-panel__title">Active alerts by severity</h2>
                <p className="fo-panel__sub">{total} active (summary counts, not full export).</p>
              </div>
              <Link className="fs-link" to="/app/alerts">All alerts <ChevronRight size={12} aria-hidden /></Link>
            </div>
            {d.alertsSummary == null && failed.includes('alertsSummary') ? (
              <EmptyState compact variant="panel" title="Alerts unavailable" message="Counts will appear after the next successful load." />
            ) : total === 0 ? (
              <EmptyState compact variant="panel" title="No active alerts" message="No alerts in Active status." />
            ) : (
              <>
                <div className="fo-sev">
                  {[['CRITICAL', crit], ['WARNING', warn], ['OTHER', other]].map(([s, n]) => (
                    <div key={s} className="fo-sev__item">
                      <span className="fo-sev__n">{n}</span>
                      <span className={`badge ${sevBadge(s)}`}>{s}</span>
                    </div>
                  ))}
                </div>
                <ul className="fo-list">
                  {rows.filter((r) => r.crit + r.warn > 0).map((r) => (
                    <li key={r.backend_id}>
                      <Link className="fs-link" to={buildBackendDetailsPath(r.backend_id)}>{shortName(r.backend_name || r.backend_id)}</Link>
                      <span>{r.crit} critical · {r.warn} warning</span>
                      <Link className="fs-link" to={buildTimelineInvestigationLocation({ backendId: r.backend_id })}>Timeline</Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        );
      case WIDGET_IDS.queueChart:
        return (
          <ChartPanel
            title="Queue depth by backend"
            question="Pending jobs from the latest queue snapshot."
            sourceKind="cached"
            state={queueRows.length ? 'ready' : 'empty'}
            emptyMessage="No queue snapshots in storage."
            minHeight={300}
            actions={<Link className="fs-link" to="/app/execution/queues">Queues</Link>}
          >
            <QtECharts
              option={queueOption}
              style={{ height: 300, width: '100%' }}
              onEvents={{ click: (p) => { const q = queueRows[p.dataIndex]; if (q?.backend_id) navigate(`/app/execution/queues?backend=${encodeURIComponent(q.backend_id)}`); } }}
            />
          </ChartPanel>
        );
      case WIDGET_IDS.calChart:
        return (
          <ChartPanel
            title="Calibration age by backend"
            question="Hours since last calibration snapshot (oldest first)."
            sourceKind="cached"
            state={calRows.length ? 'ready' : 'empty'}
            emptyMessage="No calibration records on file."
            minHeight={300}
            actions={<Link className="fs-link" to="/app/telemetry/calibration">Calibration status</Link>}
          >
            <QtECharts
              option={calOption}
              style={{ height: 300, width: '100%' }}
              onEvents={{ click: (p) => { const c = calRows[p.dataIndex]; if (c?.backend_id) navigate(buildBackendDetailsLocation(c.backend_id, 'calibration')); } }}
            />
          </ChartPanel>
        );
      case WIDGET_IDS.fleetTrend:
        return (
          <ChartPanel
            title="Alert pressure by backend"
            question="Where active critical/warning load concentrates — click a bar to open that backend."
            sourceKind="derived"
            state={alertPressureRows.length ? 'ready' : 'empty'}
            emptyMessage="No backends currently carrying active alerts."
            minHeight={300}
            actions={<Link className="fs-link" to="/app/alerts">All alerts</Link>}
          >
            <QtECharts
              option={alertPressureOption}
              style={{ height: Math.max(260, alertPressureRows.length * 36 + 60), width: '100%' }}
              onEvents={{
                click: (p) => {
                  const row = [...alertPressureRows].reverse()[p.dataIndex];
                  if (row?.id) navigate(buildBackendDetailsPath(row.id));
                },
              }}
            />
          </ChartPanel>
        );
      case WIDGET_IDS.modalityStrip:
        return (
          <ChartPanel
            title="Workload vs coherence"
            question="Pending jobs vs mean T1 per backend (same modality only)."
            sourceKind="derived"
            state={workloadScatter.length ? 'ready' : 'empty'}
            emptyMessage="Requires queue depth and T1 on overlapping backends."
            minHeight={300}
            actions={<Link className="fs-link" to="/app/telemetry/compare">Compare backends</Link>}
          >
            <QtECharts
              option={workloadOption}
              style={{ height: 300, width: '100%' }}
              onEvents={{ click: (p) => { const id = p.data?.id; if (id) navigate(buildBackendDetailsLocation(id)); } }}
            />
          </ChartPanel>
        );
      case WIDGET_IDS.platformPanel:
        return (
          <section className="card fo-panel fo-platform">
            <div className="fo-panel__head">
              <div>
                <h2 className="fo-panel__title">Platform &amp; health shape</h2>
                <p className="fo-panel__sub">Collectors, telemetry freshness, and router state on lowest-ranked backends.</p>
              </div>
              <Link className="fs-link" to="/app/platform/health">Platform health <ChevronRight size={12} aria-hidden /></Link>
            </div>
            <div className="fo-platform-kpis">
              <button type="button" className={`fo-platform-kpi${collectorBad ? ' fo-platform-kpi--bad' : ' fo-platform-kpi--ok'}`} onClick={() => navigate('/app/platform/health')}>
                <span className="fo-platform-kpi__val"><AnimatedNumber value={collectorBad} />/{providers.length ? <AnimatedNumber value={providers.length} /> : '—'}</span>
                <span className="fo-platform-kpi__lbl">Collectors bad</span>
              </button>
              <button type="button" className="fo-platform-kpi" onClick={() => navigate('/app/telemetry/live')}>
                <span className="fo-platform-kpi__val">{latestTelemetry ? formatISTTime(latestTelemetry, false) : '—'}</span>
                <span className="fo-platform-kpi__lbl">Latest telemetry</span>
              </button>
              <button type="button" className="fo-platform-kpi" onClick={() => navigate('/app/execution/queues')}>
                <span className="fo-platform-kpi__val"><AnimatedNumber value={totalPending} /></span>
                <span className="fo-platform-kpi__lbl">Fleet pending jobs</span>
              </button>
              <button type="button" className={`fo-platform-kpi${greenPct != null && greenPct < 50 ? ' fo-platform-kpi--warn' : ' fo-platform-kpi--ok'}`} onClick={() => navigate(HEALTH_PATH)}>
                <span className="fo-platform-kpi__val">{greenPct != null ? <><AnimatedNumber value={greenPct} />%</> : '—'}</span>
                <span className="fo-platform-kpi__lbl">Qubits GREEN</span>
              </button>
            </div>
            <ChartPanel
              title="Router state on lowest-ranked backends"
              question="Advisory router state counts on lowest-ranked backends."
              sourceKind="derived"
              state={rows.length ? 'ready' : 'empty'}
              minHeight={260}
              actions={<Link className="fs-link" to={HEALTH_PATH}>Open health vector</Link>}
            >
              <QtECharts
                option={routerStackOption}
                style={{ height: 260, width: '100%' }}
                onEvents={{ click: (p) => { const r = rows[p.dataIndex]; if (r?.backend_id) navigate(`${HEALTH_PATH}?backend=${encodeURIComponent(r.backend_id)}`); } }}
              />
            </ChartPanel>
          </section>
        );
      case WIDGET_IDS.coherenceChart:
        return (
          <ChartPanel
            title="T1 relaxation vs threshold"
            question="Mean and minimum T1 per backend (log scale). Compare within the same modality."
            help="Latest stored qubit telemetry. Red dashed line: health-model T1 floor for superconducting backends."
            sourceKind="stored"
            asOf={latestTelemetry ? formatISTTime(latestTelemetry) : undefined}
            state={d.coherence == null && failed.includes('coherence') ? 'error' : cohRows.length === 0 ? 'empty' : 'ready'}
            errorMessage={unableToLoad('coherence aggregates')}
            onRetry={loadData}
            emptyMessage="No stored T1 samples for any backend."
            minHeight={320}
            actions={<Link className="fs-link" to="/app/telemetry/drift">Drift analysis</Link>}
          >
            <QtECharts
              option={cohOption}
              style={{ height: Math.max(300, cohRows.length * 40 + 80), width: '100%' }}
              autoResize
              notMerge
              onEvents={{ click: (p) => { const c = cohRows[p.dataIndex]; if (c) navigate(buildBackendDetailsPath(c.backend_id)); } }}
            />
          </ChartPanel>
        );
      case WIDGET_IDS.opsTimeline:
        return (
          <section className="card fo-panel" aria-labelledby="fo-ev-h">
            <div className="fo-panel__head">
              <h2 id="fo-ev-h" className="fo-panel__title">Recent events</h2>
              <Link className="fs-link" to="/app/investigate/timeline">Full timeline <ChevronRight size={12} aria-hidden /></Link>
            </div>
            {events.length === 0 ? (
              <EmptyState compact variant="panel" title="No recent events" message="No alerts, incidents, or collector events in the window." />
            ) : (
              <ul className="fo-events">
                {events.map((ev) => (
                  <li key={`${ev.kind}-${ev.id}`}>
                    <time className="fs-muted">{formatISTTime(ev.at)}</time>
                    <span className={`badge ${sevBadge(ev.severity)}`}>{ev.severity || ev.kind}</span>
                    <span className="fo-events__title">{ev.title}</span>
                    <span className="fs-links">
                      {ev.backend_id && <Link className="fs-link" to={buildBackendDetailsPath(ev.backend_id)}>Backend</Link>}
                      <Link className="fs-link" to={buildTimelineInvestigationLocation({ backendId: ev.backend_id, alertId: ev.kind === 'alert' ? ev.id : undefined })}>Investigate</Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      default:
        return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, rows, alertSummary, crit, warn, collectorBad, calStale, qubitTotal,
    cohRows, cohOption, queueRows, queueOption, calRows, calOption, fleetStateTotals, greenPct, totalPending,
    alertPressureRows, alertPressureOption, workloadScatter, workloadOption, routerStackOption,
    events, failed, latestTelemetry, loadData, navigate, chartsReady]);

  const widgets = useMemo(
    () => layout.widgets.filter((w) => ACTIVE.includes(w.id) && (customizing || widgetVisibility[w.id] !== false)),
    [layout.widgets, customizing, widgetVisibility],
  );

  const noData = failed.length === SOURCES.length;
  const stale = lastRefresh && (Date.now() - lastRefresh.getTime()) / 60000 > 2;

  useEffect(() => {
    if (loading) return;
    if (!failed.length && !stale) return;
    const when = lastRefresh ? ` Last good load ${formatISTTime(lastRefresh)}.` : '';
    const msg = noData
      ? `Backend unreachable — no current data.${when}`
      : failed.length
        ? `Partial load: ${failed.join(', ')} failed; affected panels may be empty or stale.${when}`
        : `Telemetry is stale.${when}`;
    if (noData) notifyError(msg, { toastId: 'fleet-load' });
    else notifyWarn(msg, { toastId: 'fleet-load' });
  }, [loading, failed, noData, stale, lastRefresh]);

  if (loading) return <BoneyardSkeleton layout="dashboard" />;

  const zone = (z) => widgets.filter((w) => (PLACEMENT[w.id] || 'grid') === z);
  const nodes = (z) => zone(z).map((w) => <React.Fragment key={w.id}>{renderWidget(w.id)}</React.Fragment>);

  return (
    <div className="dashboard-home">

      {customizing && (
        <p className="dashboard-customize-hint">Drag panels to reorder. Resize cycles compact / half row / full row. Layout saves in this browser.</p>
      )}
      {customizing ? (
        <DashboardBentoGrid widgets={widgets} customizing onReorder={persistOrder} onSpanChange={setWidgetSpan} renderWidget={renderWidget} />
      ) : (
        <>
          {nodes('top')}
          {zone('grid').length > 0 && <div className="fo-grid2">{nodes('grid')}</div>}
          {zone('mid').length > 0 && <div className="fo-mid">{nodes('mid')}</div>}
          {nodes('bottom')}
        </>
      )}
    </div>
  );
}

export const DashboardHome = React.memo(DashboardHomeInner);
