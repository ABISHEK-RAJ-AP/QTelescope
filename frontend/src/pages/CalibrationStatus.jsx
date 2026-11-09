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
import { getChartTheme, baseTooltip } from '../components/observability/chartTheme.js';
import { buildBackendDetailsPath, buildDriftInvestigationLocation } from '../lib/investigationLinks.js';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { useProviderLineage, LineageBadge } from './useLineage.jsx';
import { DataPanelToolbar, SortableTh } from '../components/observability/DataViewToolbar.jsx';
import './CalibrationStatus.css';

const STATUS = {
  Fresh: { glyph: '●', color: '#34d399', badge: 'badge-healthy', action: 'None. Calibration is current.' },
  Recent: { glyph: '◐', color: '#38bdf8', badge: 'badge-info', action: 'Monitor. Recalibrate before 24 h.' },
  Aging: { glyph: '▲', color: '#fbbf24', badge: 'badge-warning', action: 'Schedule recalibration soon.' },
  Stale: { glyph: '■', color: '#fb7185', badge: 'badge-critical', action: 'Recalibrate now; avoid routing latency-critical jobs.' },
  None: { glyph: '○', color: '#64748b', badge: 'badge-info', action: 'No snapshot. Run the collector or scan this QPU in Administration.' },
};
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
  const [sort, setSort] = useState({ key: 'age', dir: 'desc' });
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
  const sortedRows = useMemo(() => {
    const list = ranked.slice();
    const mul = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let c = 0;
      if (sort.key === 'name') {
        c = String(a.b.backend_name || a.b.backend_id).localeCompare(String(b.b.backend_name || b.b.backend_id));
      } else if (sort.key === 'status') {
        c = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
      } else {
        c = (a.age ?? -1) - (b.age ?? -1);
      }
      return c * mul;
    });
    return list;
  }, [ranked, sort]);
  const plotted = ranked.filter((r) => r.age != null);

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
        data: list.map((r) => ({ value: r.age, status: r.status, itemStyle: { color: (STATUS[r.status] || STATUS.None).color } })),
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

      <ChartPanel title="Calibration age, oldest first" question="Backends with the oldest snapshots listed first." sourceKind="cached"
        minHeight={Math.max(320, plotted.length * 34 + 60)} state={plotted.length ? 'ready' : 'empty'}
        emptyTitle="No snapshots" emptyMessage="No calibration snapshots on file; age cannot be computed."
        tableAlternative={null}>
        <QtECharts option={option} style={{ height: Math.max(180, plotted.length * 34 + 60) }} notMerge />
        {plotted.length < rows.length && <p className="page-hint cs-note">No snapshot age (omitted, not plotted as zero): {ranked.filter((r) => r.age == null).map((r) => r.b.backend_name || r.b.backend_id).join(', ')}</p>}
      </ChartPanel>

      <section className="card page-panel dvt-panel">
        <h3 className="dvt-panel__title">Per-backend status</h3>
        <DataPanelToolbar layout={layout} onLayoutChange={setLayout} countLabel={`${sortedRows.length} backend${sortedRows.length === 1 ? '' : 's'}`} />
        {layout === 'grid' ? (
          <div className="dvt-grid" aria-label="Calibration by backend">
            {sortedRows.map(({ b, c, age, status }) => (
              <article key={b.backend_id} className="dvt-card">
                <header className="dvt-card__head">
                  <div>
                    <h4 className="dvt-card__title">{b.backend_name || b.backend_id}</h4>
                    <p className="dvt-card__meta">{(b.qpu_modality || 'unknown').replace('_', ' ')} · <LineageBadge lineage={lineage?.[b.provider_id]} /></p>
                  </div>
                  <Badge status={status} />
                </header>
                <dl className="dvt-card__stats">
                  <div><dt>Age</dt><dd>{age != null ? `${age.toFixed(1)} h` : 'unknown'}</dd></div>
                  <div><dt>Calibrated</dt><dd>{c?.calibration_timestamp ? formatIST(c.calibration_timestamp) : 'missing'}</dd></div>
                </dl>
                <p className="dvt-card__body">{(STATUS[status] || STATUS.None).action}</p>
                <footer className="dvt-card__foot">
                  <button type="button" className="btn btn-secondary btn--xs" onClick={() => nav(buildBackendDetailsPath(b.backend_id, 'calibration'))}>Calibration</button>
                  <button type="button" className="btn btn-secondary btn--xs" onClick={() => nav(buildDriftInvestigationLocation({ backendId: b.backend_id }))}>Drift</button>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="custom-table custom-table--dense">
              <thead>
                <tr>
                  <SortableTh sort={sort} sortKey="name" onToggle={setSort} defaultDir="asc">Backend</SortableTh>
                  <SortableTh sort={sort} sortKey="status" onToggle={setSort} defaultDir="asc">Status</SortableTh>
                  <SortableTh sort={sort} sortKey="age" onToggle={setSort} defaultDir="desc">Age</SortableTh>
                  <th>Calibrated (IST)</th>
                  <th>Next action</th>
                  <th>Links</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(({ b, c, age, status }) => (
                  <tr key={b.backend_id}>
                    <td>
                      <div className="cs-name">{b.backend_name || b.backend_id}</div>
                      <div className="cs-meta">{(b.qpu_modality || 'unknown').replace('_', ' ')} <LineageBadge lineage={lineage?.[b.provider_id]} /></div>
                    </td>
                    <td><Badge status={status} /></td>
                    <td className="cs-num">{age != null ? `${age.toFixed(1)} h` : <span className="cs-missing">unknown</span>}</td>
                    <td>{c?.calibration_timestamp ? formatIST(c.calibration_timestamp) : <span className="cs-missing">missing</span>}</td>
                    <td className="cs-action">{(STATUS[status] || STATUS.None).action}</td>
                    <td>
                      <div className="dvt-actions cs-links">
                        <button type="button" className="btn btn-secondary btn--xs" onClick={() => nav(buildBackendDetailsPath(b.backend_id, 'calibration'))}>Calibration</button>
                        <button type="button" className="btn btn-secondary btn--xs" onClick={() => nav(buildDriftInvestigationLocation({ backendId: b.backend_id }))}>Drift</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
