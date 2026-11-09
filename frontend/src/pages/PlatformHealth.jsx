import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildBackendDetailsPath } from '../lib/investigationLinks.js';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { api } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { getChartTheme, baseTooltip, chartLabelStyle, getChartSemanticColors } from '../components/observability/chartTheme.js';
import { formatISTTime } from '../utils/time';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { DataPanelToolbar } from '../components/observability/DataViewToolbar.jsx';
import { EnterpriseDataTable } from '../components/observability/EnterpriseDataTable.jsx';
import { CollapsibleSection } from '../components/observability/CollapsibleSection.jsx';
import './PlatformHealth.css';

const EXEC_LINES = (data) => {
  const coll = data?.collectors || {};
  const failed = coll.failed_count ?? 0;
  const providers = coll.providers || [];
  const ok = providers.length - failed;
  return [
    `Database ${data?.database?.reachable ? 'reachable' : 'unreachable'} · storage ${data?.database?.storage || '—'}`,
    `Collectors ${ok}/${providers.length} OK${failed ? ` · ${failed} need attention` : ''}`,
    `Latest backend telemetry ${data?.latest_backend_telemetry_at ? formatISTTime(data.latest_backend_telemetry_at) : 'none stored'}`,
    `Data mode ${data?.data_platform?.platform_data_mode || '—'}${data?.data_platform?.enable_mock_data ? ' (demo telemetry on)' : ''}`,
  ];
};

const STALE_MIN = 30;

const ts = (s) => (s && !/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? `${s}Z` : s);
const ageMin = (s) => (s ? (Date.now() - new Date(ts(s)).getTime()) / 6e4 : null);
const ageText = (m) => {
  if (m == null || !Number.isFinite(m)) return '—';
  if (m < 1) return 'just now';
  if (m < 90) return `${Math.round(m)} min ago`;
  return m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

function Tile({ title, tone, value, detail, to, onOpen }) {
  const body = (
    <>
      <span className="ph-tile__title">{title}</span>
      <span className={`ph-tile__value ph-tone--${tone}`}>{value}</span>
      <span className="ph-tile__detail">{detail}</span>
    </>
  );
  return to ? <button type="button" className="ph-tile ph-tile--link" onClick={() => onOpen(to)}>{body}</button> : <div className="ph-tile">{body}</div>;
}

export const PlatformHealth = () => {
  const nav = useNavigate();
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const [data, setData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [layout, setLayout] = useState('table');
  const { setActions, clearActions } = usePageActions();

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      api.getPlatformHealth(),
      api.getOpsTimeline(12).catch(() => []),
    ])
      .then(([r, tl]) => {
        setData(r);
        const events = Array.isArray(tl?.events) ? tl.events : (Array.isArray(tl) ? tl : []);
        setTimeline(events.slice(0, 12));
        setLastRefresh(new Date());
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh platform health" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  const db = data?.database || {};
  const coll = data?.collectors || {};
  const providers = useMemo(() => coll.providers || [], [coll.providers]);
  const providerRows = useMemo(
    () => providers.map((p) => ({
      id: p.provider_id,
      provider: p.provider_id,
      backends: p.backends_detected ?? 0,
      duration: p.duration_ms ?? 0,
      raw: p,
    })),
    [providers],
  );

  const providerColumns = useMemo(
    () => [
      { key: 'provider', label: 'Provider', render: (row) => <code>{row.provider}</code> },
      {
        key: 'status',
        label: 'Status',
        sortable: false,
        render: (row) => {
          const p = row.raw;
          return (
            <>
              <span className={`badge ${p.status === 'OK' ? 'badge-healthy' : 'badge-critical'}`}>{p.status || '—'}</span>
              {p.error && <div className="ph-err">{p.error}</div>}
            </>
          );
        },
      },
      {
        key: 'backends',
        label: 'Backends',
        defaultSortDir: 'desc',
        render: (row) => (
          <span title={(row.raw.backend_names || []).join(', ')}>{row.raw.backends_detected ?? '—'}</span>
        ),
      },
      {
        key: 'lastSuccess',
        label: 'Last success',
        sortable: false,
        render: (row) => {
          const m = ageMin(row.raw.last_success_at || row.raw.last_run_at);
          return (
            <span title={row.raw.last_success_at ? formatISTTime(row.raw.last_success_at) : ''}>{ageText(m)}</span>
          );
        },
      },
      {
        key: 'duration',
        label: 'Duration',
        defaultSortDir: 'desc',
        render: (row) => (row.raw.duration_ms != null ? `${row.raw.duration_ms} ms` : '—'),
      },
    ],
    [],
  );
  const telAge = ageMin(data?.latest_backend_telemetry_at);
  const sse = data?.sse_stream || {};

  const durationOption = useMemo(() => {
    const t = getChartTheme(isDark);
    const sem = getChartSemanticColors();
    const rows = [...providers].sort((a, b) => (a.duration_ms || 0) - (b.duration_ms || 0));
    return {
      grid: { left: 110, right: 24, top: 8, bottom: 28 },
      tooltip: { ...baseTooltip(isDark), trigger: 'item', formatter: (p) => `${p.name}<br/>${p.value} ms (last run)` },
      xAxis: { type: 'value', name: 'ms', nameTextStyle: chartLabelStyle(isDark, 10), axisLabel: chartLabelStyle(isDark, 10), splitLine: { lineStyle: { color: t.splitColor } } },
      yAxis: { type: 'category', data: rows.map((p) => p.provider_id), axisLabel: chartLabelStyle(isDark, 11) },
      series: [{ type: 'bar', barMaxWidth: 22, data: rows.map((p) => ({ value: p.duration_ms, itemStyle: { color: p.status === 'OK' ? sem.series : sem.critical } })) }],
    };
  }, [providers, isDark]);

  const statusPieOption = useMemo(() => {
    const sem = getChartSemanticColors();
    const ok = providers.filter((p) => p.status === 'OK').length;
    const bad = providers.length - ok;
    return {
      tooltip: { ...baseTooltip(isDark), trigger: 'item' },
      legend: { bottom: 0, textStyle: chartLabelStyle(isDark, 11) },
      series: [{
        type: 'pie', radius: ['42%', '68%'],
        label: { color: getChartTheme(isDark).textColor, fontSize: chartLabelStyle(isDark, 11).fontSize },
        data: [
          { name: 'OK', value: ok || 0, itemStyle: { color: sem.healthy } },
          { name: 'Attention', value: bad || 0, itemStyle: { color: sem.critical } },
        ].filter((d) => d.value > 0),
      }],
    };
  }, [providers, isDark]);

  if (loading && !data) return <BoneyardSkeleton layout="grid" />;
  if (error && !data) return <div className="page-stack"><ErrorState variant="panel" message={error} onRetry={load} /></div>;

  const failed = coll.failed_count ?? 0;
  const breakers = (coll.circuit_breakers_open || []).length;
  const mode = data?.collection_scheduler?.mode;
  const telTone = telAge == null ? 'bad' : telAge > STALE_MIN ? 'warn' : 'ok';
  const overallTone = !db.reachable || failed ? 'bad' : telTone === 'warn' || mode === 'on_demand' ? 'warn' : 'ok';

  return (
    <div className="page-stack">
      <section className="ph-summary card page-panel">
        <div className="ph-summary__head">
          <h2 className="ph-summary__title">Platform status</h2>
          <span className={`badge ${overallTone === 'ok' ? 'badge-healthy' : overallTone === 'warn' ? 'badge-warning' : 'badge-critical'}`}>
            {overallTone === 'ok' ? 'Operational' : overallTone === 'warn' ? 'Attention' : 'Degraded'}
          </span>
        </div>
        <p className="ph-summary__meta">
          Generated {data?.generated_at ? formatISTTime(data.generated_at) : '—'}
        </p>
        <ul className="ph-exec-list">
          {EXEC_LINES(data).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="page-hint ph-rbac-note">
          <strong>Who can act:</strong> all signed-in roles can view this page. Changing collectors, credentials, or schedules requires an administrator role under Administration.
        </p>
      </section>

      {(data?.synthetics || []).length > 0 && (
        <CollapsibleSection id="ph-synth" title="Synthetic probes" defaultOpen={false} className="card page-panel ph-synth" data-tour="page-platform-synthetic">
          <p className="page-hint">In-process checks on each platform-health refresh — not distributed synthetics.</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(data.synthetics || []).map((p) => (
              <li key={p.probe_id} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <strong>{p.name}</strong>
                <span className={p.status === 'OK' ? 'badge badge-healthy' : 'badge badge-critical'}>{p.status}</span>
                <span className="ph-timeline__meta">{p.latency_ms} ms · {p.target}{p.error ? ` · ${p.error}` : ''}</span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {(data?.slis || []).length > 0 && (
        <CollapsibleSection id="ph-sli" title="Service level indicators" defaultOpen={false} className="card page-panel ph-slo" data-tour="page-platform-sli">
          <p className="page-hint">Measured from stored collector execution history — not an external time-series backend.</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(data.slis || []).map((s) => (
              <li key={s.sli_id} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'baseline', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <strong>{s.name}</strong>
                <span className={s.missing_data ? 'badge badge-info' : s.compliant ? 'badge badge-healthy' : 'badge badge-warning'}>
                  {s.missing_data ? 'No data' : `${(s.value * 100).toFixed(1)}%`}
                </span>
                <span className="ph-timeline__meta">
                  target {(s.target * 100).toFixed(0)}% · {s.numerator}/{s.denominator} in {s.window_hours}h · {s.data_source}
                </span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      <section className="ph-tiles" aria-label="Platform status" data-tour="page-platform">
        <Tile title="Database" tone={db.reachable ? 'ok' : 'bad'} value={db.reachable ? 'Reachable' : 'Unreachable'} detail={`${db.storage || '—'}${db.error ? ` · ${db.error}` : ''}`} />
        <Tile title="Collectors" tone={failed ? 'bad' : 'ok'} value={failed ? `${failed} failing` : `${providers.length - failed} of ${providers.length} OK`} detail={`DLQ ${coll.dlq_recent_count ?? 0} · breakers open ${breakers} · run history in admin`} to="/app/admin/collectors" onOpen={nav} />
        <Tile title="Telemetry store" tone={telTone} value={ageText(telAge)} detail={data?.latest_backend_telemetry_at ? formatISTTime(data.latest_backend_telemetry_at) : 'No samples stored'} />
        <Tile title="Scheduler" tone={mode === 'on_demand' ? 'warn' : 'ok'} value={mode === 'on_demand' ? 'On demand' : (mode || '—')} detail={data?.collection_scheduler?.note || 'Collection cycle control'} to="/app/admin/collectors" onOpen={nav} />
        <Tile title="Event stream" tone="ok" value="Database aggregate SSE" detail={sse.stream_kind || 'Platform refresh ticks'} />
      </section>

      <section className="ph-split">
        <div className="card page-panel ph-providers dvt-panel">
          <header className="chart-panel__head"><div className="chart-panel__titles">
            <h3 className="chart-panel__title">Provider adapters</h3>
            <p className="chart-panel__question">Last successful collection per vendor adapter.</p>
          </div></header>
          <DataPanelToolbar layout={layout} onLayoutChange={setLayout} countLabel={`${providers.length} provider${providers.length === 1 ? '' : 's'}`} />
          {layout === 'grid' ? (
            <div className="dvt-grid">
              {providers.length === 0 && <p className="page-hint" style={{ gridColumn: '1 / -1', padding: '0 14px 14px' }}>No collector runs recorded.</p>}
              {providers.map((p) => {
                const m = ageMin(p.last_success_at || p.last_run_at);
                return (
                  <article key={p.provider_id} className="dvt-card">
                    <header className="dvt-card__head">
                      <code className="dvt-card__title" style={{ fontSize: 13 }}>{p.provider_id}</code>
                      <span className={`badge ${p.status === 'OK' ? 'badge-healthy' : 'badge-critical'}`}>{p.status || '—'}</span>
                    </header>
                    {p.error && <p className="dvt-card__body ph-err">{p.error}</p>}
                    <dl className="dvt-card__stats">
                      <div><dt>Backends</dt><dd>{p.backends_detected ?? '—'}</dd></div>
                      <div><dt>Last success</dt><dd>{ageText(m)}</dd></div>
                      <div><dt>Duration</dt><dd>{p.duration_ms != null ? `${p.duration_ms} ms` : '—'}</dd></div>
                    </dl>
                  </article>
                );
              })}
            </div>
          ) : (
            <EnterpriseDataTable
              rows={providerRows}
              columns={providerColumns}
              loading={loading && !data}
              searchKeys={['provider']}
              searchPlaceholder="Search providers"
              pageSize={12}
              emptyTitle="No collector runs"
              emptyMessage="No collector runs recorded."
              ariaLabel="Provider adapters"
            />
          )}
        </div>

        <div className="ph-charts-col">
          <ChartPanel title="Last collection duration" question="Slowest adapter on the most recent run." sourceKind="derived"
            state={providers.length ? 'ready' : 'empty'} emptyMessage="No collector runs yet." minHeight={220}
            tableAlternative={(
              <table className="custom-table custom-table--dense">
                <thead><tr><th>Provider</th><th>Duration (ms)</th><th>Status</th></tr></thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.provider_id}><td><code>{p.provider_id}</code></td><td>{p.duration_ms ?? '—'}</td><td>{p.status}</td></tr>
                  ))}
                </tbody>
              </table>
            )}>
            <QtECharts option={durationOption} style={{ height: Math.max(200, providers.length * 42) }} notMerge />
          </ChartPanel>
          <ChartPanel title="Adapter health mix" question="OK versus attention required." sourceKind="derived"
            state={providers.length ? 'ready' : 'empty'} minHeight={260}>
            <QtECharts option={statusPieOption} style={{ height: 260 }} notMerge />
          </ChartPanel>
        </div>
      </section>

      {(data?.ingestion_quality_latest || []).length > 0 && (
        <section className="card page-panel" data-tour="page-platform-quality">
          <h3 className="chart-panel__title">Ingestion quality (latest cycle)</h3>
          <p className="page-hint">Measured row counts from the collector — rejected/duplicate counts are not inferred.</p>
          <table className="custom-table custom-table--dense">
            <thead>
              <tr>
                <th>Provider</th><th>Outcome</th><th>Completeness</th><th>Backends</th><th>Telemetry rows</th><th>When</th>
              </tr>
            </thead>
            <tbody>
              {(data.ingestion_quality_latest || []).map((q) => (
                <tr key={q.report_id || q.provider_id}>
                  <td><code>{q.provider_id}</code></td>
                  <td>{q.quality_outcome || q.status}</td>
                  <td>{q.completeness_pct != null ? `${q.completeness_pct}%` : '—'}</td>
                  <td>{q.received_backends ?? '—'}</td>
                  <td>{q.backend_telemetry_rows ?? '—'}</td>
                  <td>{q.timestamp ? formatISTTime(q.timestamp) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(data?.dependency_links || []).length > 0 && (
        <section className="card page-panel" data-tour="page-platform-dependencies">
          <h3 className="chart-panel__title">Dependency map</h3>
          <p className="page-hint">Collector status → registered backends → active alerts (counts from database).</p>
          <ul className="ph-dep-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(data.dependency_links || []).map((row) => (
              <li key={row.provider_id} style={{ marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{row.provider_id}</strong>
                  <span className="badge badge-info">collector {row.collector_status || '—'}</span>
                  <Link className="fs-link" to="/app/admin/collectors">Run history</Link>
                </div>
                <ul style={{ margin: '8px 0 0', paddingLeft: 16 }}>
                  {(row.backends || []).map((b) => (
                    <li key={b.backend_id} style={{ marginTop: 4 }}>
                      <Link to={buildBackendDetailsPath(b.backend_id)}>{b.backend_name || b.backend_id}</Link>
                      <span className="ph-timeline__meta"> · {b.operational_status} · {b.active_alerts} active alert{b.active_alerts === 1 ? '' : 's'}</span>
                      {b.active_alerts > 0 && (
                        <Link className="fs-link" style={{ marginLeft: 8 }} to={`/app/alerts?backend=${encodeURIComponent(b.backend_id)}`}>Alerts</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {timeline.length > 0 && (
        <section className="card page-panel ph-timeline">
          <h3 className="chart-panel__title">Recent platform activity</h3>
          <ul className="ph-timeline__list">
            {timeline.map((ev) => (
              <li key={`${ev.kind}-${ev.id}-${ev.at}`}>
                <span className={`badge ${ev.severity === 'CRITICAL' ? 'badge-critical' : ev.severity === 'WARNING' ? 'badge-warning' : 'badge-info'}`}>{ev.kind}</span>
                <span className="ph-timeline__title">{ev.title}</span>
                <span className="ph-timeline__meta">{ev.backend_id ? `${ev.backend_id} · ` : ''}{ev.at ? formatISTTime(ev.at) : '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
