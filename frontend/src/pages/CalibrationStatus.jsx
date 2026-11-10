import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { api } from '../services/api';
import { formatIST } from '../utils/time';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { getChartTheme, baseTooltip, getChartSemanticColors, getCalibrationStatusChartColors } from '../components/observability/chartTheme.js';
import { buildBackendDetailsPath, buildDriftInvestigationLocation } from '../lib/investigationLinks.js';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { useProviderLineage, LineageBadge } from './useLineage.jsx';
import { DataPanelToolbar } from '../components/observability/DataViewToolbar.jsx';
import { EnterpriseDataTable } from '../components/observability/EnterpriseDataTable.jsx';
import './CalibrationStatus.css';

function calibrationStatusMeta() {
  const c = getCalibrationStatusChartColors();
  return {
    Fresh: { glyph: '●', color: c.Fresh, badge: 'badge-healthy', action: 'None. Calibration is current.' },
    Recent: { glyph: '◐', color: c.Recent, badge: 'badge-info', action: 'Monitor. Recalibrate before 24 h.' },
    Aging: { glyph: '▲', color: c.Aging, badge: 'badge-warning', action: 'Schedule recalibration soon.' },
    Stale: { glyph: '■', color: c.Stale, badge: 'badge-critical', action: 'Recalibrate now; avoid routing latency-critical jobs.' },
    None: { glyph: '○', color: c.None, badge: 'badge-info', action: 'No snapshot. Run the collector or scan this QPU in Administration.' },
  };
}
const STATUS = new Proxy({}, {
  get: (_t, prop) => calibrationStatusMeta()[prop],
});
const THRESHOLDS = [6, 12, 24];
const STATUS_RANK = { Stale: 0, Aging: 1, Recent: 2, Fresh: 3, None: 4 };

const Badge = ({ status }) => {
  const s = STATUS[status] || STATUS.None;
  return <span className={`badge ${s.badge}`}><span aria-hidden>{s.glyph}</span> {status === 'None' ? 'No snapshot' : status}</span>;
};

export const CalibrationStatus = () => {
  const nav = useNavigate();
  const { resolved } = useTheme();
  const lineage = useProviderLineage();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [layout, setLayout] = useState('table');
  const { setActions, clearActions } = usePageActions();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [backends, calList] = await Promise.all([api.getBackends(), api.getCalibrations()]);
      const calByBackend = Object.fromEntries((calList || []).map((c) => [c.backend_id, c]));
      setRows((backends || []).map((b) => {
        const c = calByBackend[b.backend_id] ?? null;
        const age = c && Number.isFinite(Number(c.calibration_age)) ? Number(c.calibration_age) : null;
        return { b, c, age, status: c ? (c.freshness_status || 'None') : 'None' };
      }));
      setLastRefresh(new Date());
    } catch (e) {
      setError(String(e.message || e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh calibration" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  // oldest first; missing snapshots last (age unknown, never plotted as 0)
  const ranked = useMemo(() => (rows || []).slice().sort((a, b) => (b.age ?? -1) - (a.age ?? -1)), [rows]);
  const tableRows = useMemo(
    () => ranked.map(({ b, c, age, status }) => ({
      id: b.backend_id,
      name: b.backend_name || b.backend_id,
      backend_id: b.backend_id,
      status,
      status_rank: STATUS_RANK[status] ?? 9,
      age: age ?? -1,
      ageLabel: age != null ? `${age.toFixed(1)} h` : 'unknown',
      calibrated: c?.calibration_timestamp ? formatIST(c.calibration_timestamp) : 'missing',
      action: (STATUS[status] || STATUS.None).action,
      modality: (b.qpu_modality || 'unknown').replace('_', ' '),
      provider_id: b.provider_id,
    })),
    [ranked],
  );
  const calTableColumns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Backend',
        render: (row) => (
          <>
            <div className="cs-name">{row.name}</div>
            <div className="cs-meta">
              {row.modality} <LineageBadge lineage={lineage?.[row.provider_id]} />
            </div>
          </>
        ),
      },
      {
        key: 'status_rank',
        label: 'Status',
        defaultSortDir: 'asc',
        render: (row) => <Badge status={row.status} />,
      },
      {
        key: 'age',
        label: 'Age',
        defaultSortDir: 'desc',
        render: (row) => (
          <span className="cs-num">
            {row.age >= 0 ? row.ageLabel : <span className="cs-missing">unknown</span>}
          </span>
        ),
      },
      { key: 'calibrated', label: 'Calibrated (IST)' },
      { key: 'action', label: 'Next action', className: 'cs-action' },
      {
        key: 'backend_id',
        label: 'Links',
        sortable: false,
        render: (row) => (
          <div className="dvt-actions cs-links">
            <button type="button" className="btn btn-secondary btn--xs" onClick={() => nav(buildBackendDetailsPath(row.backend_id, 'calibration'))}>Calibration</button>
            <button type="button" className="btn btn-secondary btn--xs" onClick={() => nav(buildDriftInvestigationLocation({ backendId: row.backend_id }))}>Drift</button>
          </div>
        ),
      },
    ],
    [lineage, nav],
  );
  const plotted = ranked.filter((r) => r.age != null);

  const freshnessBarColor = (status) => {
    const sem = getChartSemanticColors();
    const map = { Fresh: sem.healthy, Recent: sem.info, Aging: sem.warn, Stale: sem.critical, None: sem.unknown };
    return map[status] || sem.unknown;
  };

  const option = useMemo(() => {
    const t = getChartTheme(resolved === 'dark');
    const list = plotted.slice().reverse();
    return {
      grid: { left: 150, right: 40, top: 16, bottom: 32 },
      tooltip: { ...baseTooltip(resolved === 'dark'), trigger: 'item', formatter: (p) => `${p.name}<br/>${p.value.toFixed(1)} h · ${p.data.status}` },
      xAxis: { type: 'value', name: 'hours since calibration', nameLocation: 'middle', nameGap: 22, nameTextStyle: { color: t.textColor }, axisLabel: { color: t.textColor }, splitLine: { lineStyle: { color: t.splitColor } } },
      yAxis: { type: 'category', data: list.map((r) => r.b.backend_name || r.b.backend_id), axisLabel: { color: t.textColor, width: 140, overflow: 'truncate' } },
      series: [{
        type: 'bar', barMaxWidth: 20,
        data: list.map((r) => ({ value: r.age, status: r.status, itemStyle: { color: freshnessBarColor(r.status) } })),
        label: { show: true, position: 'right', color: t.textColor, formatter: (p) => `${STATUS[p.data.status]?.glyph || ''} ${p.data.status}` },
        markLine: { symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: t.axisLine }, label: { color: t.textColor, formatter: '{c} h' }, data: THRESHOLDS.map((x) => ({ xAxis: x })) },
      }],
    };
  }, [plotted, resolved]);

  if (error && !rows) return <div className="page-stack"><ErrorState variant="panel" message={error} onRetry={load} /></div>;
  if (!rows) return <BoneyardSkeleton layout="grid" />;
  if (!rows.length) return <EmptyState variant="panel" title="No backends" message="Add backends under Configure first." />;

  const count = (s) => rows.filter((r) => r.status === s).length;

  return (
    <div className="page-stack">
      <section className="cs-kpis" aria-label="Calibration freshness" data-tour="page-calibration">
        {['Fresh', 'Recent', 'Aging', 'Stale', 'None'].map((s) => (
          <div className={`cs-kpi card cs-kpi--${s.toLowerCase()}`} key={s}>
            <div className="cs-kpi__label">{s === 'None' ? 'No snapshot' : s}</div>
            <div className="cs-kpi__value">{count(s)}</div>
            <div className="cs-kpi__sub">{{ Fresh: 'Updated within 6 h', Recent: '6–12 h since cal', Aging: '12–24 h since cal', Stale: 'Over 24 h old', None: 'No calibration snapshot' }[s]}</div>
          </div>
        ))}
      </section>

      <ChartPanel
        title="Calibration age, oldest first"
        titleTo="/app/telemetry/cal-timeline"
        question="Backends with the oldest snapshots listed first."
        minHeight={Math.max(320, plotted.length * 34 + 60)}
        state={plotted.length ? 'ready' : 'empty'}
        emptyTitle="No snapshots"
        emptyMessage="No calibration snapshots on file; age cannot be computed."
        tableAlternative={null}
      >
        <QtECharts option={option} style={{ height: Math.max(180, plotted.length * 34 + 60) }} notMerge />
        {plotted.length < rows.length && <p className="page-hint cs-note">No snapshot age (omitted, not plotted as zero): {ranked.filter((r) => r.age == null).map((r) => r.b.backend_name || r.b.backend_id).join(', ')}</p>}
      </ChartPanel>

      <section className="card page-panel dvt-panel">
        <h3 className="dvt-panel__title">Per-backend status</h3>
        <DataPanelToolbar layout={layout} onLayoutChange={setLayout} countLabel={`${ranked.length} backend${ranked.length === 1 ? '' : 's'}`} />
        {layout === 'grid' ? (
          <div className="dvt-grid" aria-label="Calibration by backend">
            {ranked.map(({ b, c, age, status }) => (
              <article
                key={b.backend_id}
                className="dvt-card dvt-card--action"
                role="button"
                tabIndex={0}
                onClick={() => nav(buildBackendDetailsPath(b.backend_id, 'calibration'))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    nav(buildBackendDetailsPath(b.backend_id, 'calibration'));
                  }
                }}
              >
                <header className="dvt-card__head">
                  <div>
                    <h4 className="dvt-card__title dvt-card__title--link">{b.backend_name || b.backend_id}</h4>
                    <p className="dvt-card__meta">{(b.qpu_modality || 'unknown').replace('_', ' ')} · <LineageBadge lineage={lineage?.[b.provider_id]} /></p>
                  </div>
                  <Badge status={status} />
                </header>
                <dl className="dvt-card__stats">
                  <div><dt>Age</dt><dd>{age != null ? `${age.toFixed(1)} h` : 'unknown'}</dd></div>
                  <div><dt>Calibrated</dt><dd>{c?.calibration_timestamp ? formatIST(c.calibration_timestamp) : 'missing'}</dd></div>
                </dl>
                <p className="dvt-card__body">{(STATUS[status] || STATUS.None).action}</p>
                <p className="dvt-card__hint">
                  <button
                    type="button"
                    className="fs-link"
                    style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); nav(buildDriftInvestigationLocation({ backendId: b.backend_id })); }}
                  >
                    Drift analysis
                  </button>
                </p>
              </article>
            ))}
          </div>
        ) : (
          <EnterpriseDataTable
            rows={tableRows}
            columns={calTableColumns}
            searchKeys={['name', 'backend_id', 'status', 'modality']}
            searchPlaceholder="Search backends…"
            pageSize={15}
            initialSort={{ key: 'age', dir: 'desc' }}
            ariaLabel="Calibration by backend"
          />
        )}
      </section>
    </div>
  );
};
