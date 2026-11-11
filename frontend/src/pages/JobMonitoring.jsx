import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { CheckCircle2, PlayCircle, Clock, XCircle, Ban } from 'lucide-react';
import { api, fetchApi } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { DetailDrawer } from '../components/observability/DetailDrawer.jsx';
import {
  DetailModalBody,
  DetailModalSection,
  DetailModalDl,
  DetailModalRow,
  DetailModalTimeline,
  DetailModalRelated,
  DetailModalProvenance,
  DetailModalCallout,
} from '../components/observability/DetailModalLayout.jsx';
import { PageRelatedLink } from '../components/observability/PageRelatedNav.jsx';
import { TableEmpty } from '../components/observability/EmptyState.jsx';
import { getChartTheme, baseTooltip, getChartSemanticColors, getJobStatusChartColors } from '../components/observability/chartTheme.js';
import { buildBackendDetailsPath, buildTimelineInvestigationLocation, buildDriftInvestigationLocation } from '../lib/investigationLinks.js';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { formatIST } from '../utils/time';
import { DataPanelToolbar } from '../components/observability/DataViewToolbar.jsx';
import { EnterpriseDataTable } from '../components/observability/EnterpriseDataTable.jsx';
import { unableToLoad } from '../constants/messages.js';
import './JobMonitoring.css';

const POLL_MS = 15000;
const PAGE_SIZE = 12;
const STATUS_ORDER = ['COMPLETED', 'FAILED', 'CANCELLED', 'RUNNING', 'QUEUED'];
const STATUS_ICONS = {
  COMPLETED: CheckCircle2,
  FAILED: XCircle,
  CANCELLED: Ban,
  RUNNING: PlayCircle,
  QUEUED: Clock,
};
const STATUS_LABELS = {
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  RUNNING: 'Running',
  QUEUED: 'Queued',
};
const STATUS_TERMINAL = { COMPLETED: true, FAILED: true, CANCELLED: true, RUNNING: false, QUEUED: false };
const meta = (s) => {
  const colors = getJobStatusChartColors();
  const color = colors[s] || getChartSemanticColors().unknown;
  return {
    label: STATUS_LABELS[s] || s,
    color,
    Icon: STATUS_ICONS[s] || Clock,
    terminal: STATUS_TERMINAL[s] ?? true,
  };
};
const isFail = (s) => s !== 'COMPLETED' && meta(s).terminal;

const ts = (v) => (v ? new Date(v.endsWith('Z') ? v : `${v}Z`) : null);
const fmtTs = (v) => (v ? formatIST(ts(v)) : '—');
const fmtDur = (s) => (s == null ? '—' : s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${s.toFixed(1)}s`);
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(0)}%` : '—');

function StatusBadge({ status }) {
  const m = meta(status);
  return <span className="jm-status" data-s={status}><m.Icon size={13} aria-hidden="true" />{m.label}</span>;
}

function JobDrawerBody({ job, nav }) {
  const m = meta(job.status);
  const timeline = [
    { label: 'Submitted', value: fmtTs(job.submitted_at), known: true },
    { label: 'Started', value: job.started_at ? fmtTs(job.started_at) : 'Not recorded by provider', known: Boolean(job.started_at) },
    { label: 'Finished', value: job.completed_at ? fmtTs(job.completed_at) : 'Not recorded by provider', known: Boolean(job.completed_at) },
    { label: 'Current state', value: `${m.label}${m.terminal ? '' : ' (in progress)'}`, known: true },
  ];
  return (
    <DetailModalBody>
      {job.failure_reason && (
        <DetailModalCallout><b>{job.failure_category_label || 'Failure'}:</b> {job.failure_reason}</DetailModalCallout>
      )}
      <DetailModalSection title="Lifecycle">
        <DetailModalTimeline items={timeline} />
      </DetailModalSection>
      <DetailModalSection title="Details">
        <DetailModalDl>
          <DetailModalRow label="Job ID">{job.job_id}</DetailModalRow>
          <DetailModalRow label="Backend">{job.backend_id}</DetailModalRow>
          <DetailModalRow label="Calibration">{job.calibration_identifier || '—'}</DetailModalRow>
          <DetailModalRow label="Tags">{job.tags?.length ? job.tags.join(', ') : '—'}</DetailModalRow>
        </DetailModalDl>
        <DetailModalProvenance>Source: stored job records in platform DB (not a live vendor query).</DetailModalProvenance>
      </DetailModalSection>
      <DetailModalRelated>
        <PageRelatedLink onClick={() => nav(buildBackendDetailsPath(job.backend_id, 'execution'))}>Backend execution</PageRelatedLink>
        <PageRelatedLink onClick={() => nav(`/app/execution/queues?backend=${encodeURIComponent(job.backend_id)}`)}>Backend queue</PageRelatedLink>
        <PageRelatedLink onClick={() => nav(buildTimelineInvestigationLocation({ backendId: job.backend_id }))}>Timeline</PageRelatedLink>
        <PageRelatedLink onClick={() => nav(buildDriftInvestigationLocation({ backendId: job.backend_id }))}>Drift</PageRelatedLink>
      </DetailModalRelated>
    </DetailModalBody>
  );
}

export const JobMonitoring = () => {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  const t = getChartTheme(dark);
  const { setActions, clearActions } = usePageActions();

  const [jobs, setJobs] = useState(null);
  const [failures, setFailures] = useState(null);
  const [names, setNames] = useState({});
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const [status, setStatus] = useState('ALL');
  const backend = params.get('backend') || 'ALL';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [layout, setLayout] = useState('table');

  const load = useCallback(async () => {
    try {
      const [j, f, b] = await Promise.all([
        fetchApi('/jobs?limit=200'),
        api.getJobFailureAnalytics().catch(() => null),
        api.getBackends().catch(() => []),
      ]);
      setJobs(j || []);
      setFailures(f);
      setNames(Object.fromEntries((b || []).map((x) => [x.backend_id, x.backend_name || x.backend_id])));
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message || unableToLoad('the job list'));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => { load(); setNow(Date.now()); }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);
  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh jobs" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  const setBackend = (v) => {
    const next = new URLSearchParams(params);
    if (v === 'ALL') next.delete('backend'); else next.set('backend', v);
    setParams(next, { replace: true });
    setPage(1);
  };

  const label = useCallback((id) => names[id] || id, [names]);

  const stats = useMemo(() => {
    const list = jobs || [];
    const counts = {};
    list.forEach((j) => { counts[j.status] = (counts[j.status] || 0) + 1; });
    const done = list.filter((j) => meta(j.status).terminal);
    const ok = counts.COMPLETED || 0;
    const active = (counts.RUNNING || 0) + (counts.QUEUED || 0);
    const backends = [...new Set(list.map((j) => j.backend_id))].sort();
    const per = backends.map((id) => {
      const mine = list.filter((j) => j.backend_id === id);
      const term = mine.filter((j) => meta(j.status).terminal);
      const good = mine.filter((j) => j.status === 'COMPLETED');
      const rts = good.map((j) => j.runtime).filter((r) => r != null).sort((a, b) => a - b);
      return {
        id, total: mine.length, terminal: term.length, ok: good.length,
        counts: Object.fromEntries(STATUS_ORDER.map((s) => [s, mine.filter((j) => j.status === s).length])),
        median: rts.length ? rts[Math.floor(rts.length / 2)] : null,
      };
    });
    const runtimes = list.filter((j) => j.status === 'COMPLETED' && j.runtime != null).map((j) => j.runtime);
    const reasons = {};
    list.filter((j) => isFail(j.status)).forEach((j) => {
      const k = j.failure_reason || `${meta(j.status).label} (no reason recorded)`;
      reasons[k] = (reasons[k] || 0) + 1;
    });
    return {
      counts, total: list.length, active, terminal: done.length, ok, backends, per, runtimes,
      reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]),
    };
  }, [jobs]);

  const histogram = useMemo(() => {
    const r = stats.runtimes;
    if (!r.length) return [];
    const max = Math.max(...r);
    const step = max <= 30 ? 5 : max <= 120 ? 10 : Math.pow(10, Math.ceil(Math.log10(max / 8)));
    const bins = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => ({ lo: i * step, hi: (i + 1) * step, n: 0 }));
    r.forEach((v) => { bins[Math.floor(v / step)].n += 1; });
    return bins;
  }, [stats.runtimes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = (jobs || []).filter((j) => (status === 'ALL' || j.status === status)
      && (backend === 'ALL' || j.backend_id === backend)
      && (!q || j.job_id.toLowerCase().includes(q) || (j.calibration_identifier || '').toLowerCase().includes(q)
        || (j.failure_reason || '').toLowerCase().includes(q)));
    return rows;
  }, [jobs, status, backend, search]);

  const jobTableRows = useMemo(
    () => filtered.map((j) => ({
      id: j.job_id,
      job_id: j.job_id,
      backend_id: j.backend_id,
      backend_label: label(j.backend_id),
      status: j.status,
      status_rank: STATUS_ORDER.indexOf(j.status) >= 0 ? STATUS_ORDER.indexOf(j.status) : 99,
      submitted_at: fmtTs(j.submitted_at),
      submitted_sort: ts(j.submitted_at)?.getTime() ?? 0,
      runtime: j.runtime ?? -1,
      runtime_label: fmtDur(j.runtime),
      failure_reason: j.failure_reason || '—',
      _job: j,
    })),
    [filtered, label],
  );

  const jobTableColumns = useMemo(
    () => [
      {
        key: 'job_id',
        label: 'Job',
        render: (row) => (
          <button type="button" className="jm-link" onClick={() => setSelectedId(row.job_id)} aria-label={`Open job ${row.job_id}`}>
            {row.job_id}
          </button>
        ),
      },
      { key: 'backend_label', label: 'Backend' },
      {
        key: 'status_rank',
        label: 'Status',
        defaultSortDir: 'asc',
        render: (row) => <StatusBadge status={row.status} />,
      },
      { key: 'submitted_sort', label: 'Submitted', defaultSortDir: 'desc', render: (row) => row.submitted_at },
      {
        key: 'runtime',
        label: 'Runtime',
        defaultSortDir: 'desc',
        render: (row) => <span className="jm-num">{row.runtime_label}</span>,
      },
      { key: 'failure_reason', label: 'Failure reason', className: 'jm-reason' },
    ],
    [],
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const shown = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const selected = (jobs || []).find((j) => j.job_id === selectedId);

  const axis = (extra = {}) => ({
    axisLabel: { color: t.textColor }, axisLine: { lineStyle: { color: t.axisLine } }, splitLine: { lineStyle: { color: t.splitColor } }, ...extra,
  });
  const grid = { left: 8, right: 16, top: 28, bottom: 8, containLabel: true };

  const statusOption = useMemo(() => ({
    grid, tooltip: { ...baseTooltip(dark), axisPointer: { type: 'shadow' } },
    legend: { top: 0, textStyle: { color: t.textColor } },
    xAxis: { type: 'value', minInterval: 1, ...axis() },
    yAxis: { type: 'category', inverse: true, data: stats.per.map((p) => label(p.id)), ...axis({ splitLine: { show: false } }) },
    series: STATUS_ORDER.map((s) => ({
      name: meta(s).label, type: 'bar', stack: 'st', itemStyle: { color: meta(s).color },
      data: stats.per.map((p) => p.counts[s]),
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [stats.per, dark, label]);

  const histOption = useMemo(() => {
    const sem = getChartSemanticColors();
    return {
      grid, tooltip: { ...baseTooltip(dark), axisPointer: { type: 'shadow' } },
      xAxis: { type: 'category', name: 'runtime (s)', nameLocation: 'middle', nameGap: 28, data: histogram.map((b) => `${b.lo}–${b.hi}`), ...axis() },
      yAxis: { type: 'value', minInterval: 1, name: 'jobs', ...axis() },
      series: [{ type: 'bar', data: histogram.map((b) => b.n), itemStyle: { color: sem.series }, barCategoryGap: '12%' }],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histogram, dark]);

  const cats = failures?.by_category || [];
  const failOption = useMemo(() => {
    const sem = getChartSemanticColors();
    return {
      grid, tooltip: { ...baseTooltip(dark), axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', minInterval: 1, ...axis() },
      yAxis: { type: 'category', inverse: true, data: cats.map((c) => c.label), ...axis({ splitLine: { show: false } }) },
      series: [{ type: 'bar', data: cats.map((c) => c.count), itemStyle: { color: sem.critical }, label: { show: true, position: 'right', color: t.textColor } }],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats, dark]);

  if (!jobs && !error) return <BoneyardSkeleton layout="table-plain" />;
  if (!jobs) return <div className="page-stack"><ErrorState variant="panel" message={error} onRetry={load} /></div>;

  const stale = lastRefresh && now - lastRefresh.getTime() > POLL_MS * 2.5;
  return (
    <div className="page-stack jm">
      {(error || stale) && (
        <p className="jm-banner" role="status">
          {error ? `Refresh failed (${error}). ` : ''}Showing data from {lastRefresh ? formatIST(lastRefresh) : 'earlier'}; may be stale.
        </p>
      )}

      <section className="jm-kpis" aria-label="Job summary">
        <div className="jm-kpi"><div className="jm-kpi__label">Jobs loaded</div><div className="jm-kpi__value">{stats.total}</div><div className="jm-kpi__sub">latest 200 stored records</div></div>
        <div className="jm-kpi"><div className="jm-kpi__label">In flight</div><div className="jm-kpi__value">{stats.active}</div><div className="jm-kpi__sub">{stats.counts.RUNNING || 0} running · {stats.counts.QUEUED || 0} queued</div></div>
        <div className="jm-kpi"><div className="jm-kpi__label">Success rate</div><div className="jm-kpi__value">{pct(stats.ok, stats.terminal)}</div><div className="jm-kpi__sub">{stats.ok} of {stats.terminal} finished (excludes in-flight)</div></div>
        <div className="jm-kpi"><div className="jm-kpi__label">Not successful</div><div className="jm-kpi__value">{stats.terminal - stats.ok}</div><div className="jm-kpi__sub">{stats.counts.FAILED || 0} failed · {stats.counts.CANCELLED || 0} cancelled</div></div>
      </section>

      <section className="jm-charts">
        <ChartPanel
          title="Jobs by backend and status"
          titleTo="/app/execution/jobs"
          question="Job volume and failure rate by backend."
          sourceKind="cached" asOf={lastRefresh ? formatIST(lastRefresh) : undefined}
          state={stats.per.length ? 'ready' : 'empty'} emptyTitle="No jobs" minHeight={Math.max(200, stats.per.length * 44 + 60)}
          tableAlternative={(
            <table className="jm-alt">
              <thead><tr><th scope="col">Backend</th>{STATUS_ORDER.map((s) => <th key={s} scope="col">{meta(s).label}</th>)}<th scope="col">Success rate</th><th scope="col">Median runtime</th></tr></thead>
              <tbody>{stats.per.map((p) => (
                <tr key={p.id}><th scope="row">{label(p.id)}</th>{STATUS_ORDER.map((s) => <td key={s}>{p.counts[s]}</td>)}<td>{pct(p.ok, p.terminal)}</td><td>{fmtDur(p.median)}</td></tr>
              ))}</tbody>
            </table>
          )}
        >
          <QtECharts option={statusOption} style={{ height: Math.max(200, stats.per.length * 44 + 60) }} />
        </ChartPanel>

        <ChartPanel
          title="Runtime distribution"
          titleTo="/app/execution/queues"
          question="Runtime distribution for completed jobs."
          sourceKind="derived" detail="Completed jobs with a recorded runtime only."
          state={histogram.length ? 'ready' : 'empty'} emptyTitle="No completed runtimes" minHeight={240}
          tableAlternative={(
            <table className="jm-alt">
              <thead><tr><th scope="col">Runtime (s)</th><th scope="col">Jobs</th></tr></thead>
              <tbody>{histogram.map((b) => <tr key={b.lo}><th scope="row">{b.lo}–{b.hi}</th><td>{b.n}</td></tr>)}</tbody>
            </table>
          )}
        >
          <QtECharts option={histOption} style={{ height: 240 }} />
        </ChartPanel>

        <ChartPanel
          title="Failure categories"
          titleTo="/app/investigate/timeline"
          question="Failure categories in the selected window."
          sourceKind="derived" asOf={undefined}
          provenanceDetail={failures ? `Classified over latest 500 jobs (${failures.total_failed} failed/cancelled).` : undefined}
          state={failures == null ? 'error' : cats.length ? 'ready' : 'empty'}
          errorMessage="Failure analytics unavailable." onRetry={load}
          emptyTitle="No failures" emptyMessage="No failed or cancelled jobs in range." minHeight={200}
          tableAlternative={(
            <table className="jm-alt">
              <thead><tr><th scope="col">Category</th><th scope="col">Count</th></tr></thead>
              <tbody>{cats.map((c) => <tr key={c.category_id}><th scope="row">{c.label}</th><td>{c.count}</td></tr>)}</tbody>
            </table>
          )}
        >
          <QtECharts option={failOption} style={{ height: Math.max(160, cats.length * 44 + 40) }} />
          {stats.reasons.length > 0 && (
            <ul className="jm-reasons" aria-label="Top failure reasons in loaded jobs">
              {stats.reasons.slice(0, 4).map(([r, n]) => <li key={r}><span>{r}</span><b>{n}</b></li>)}
            </ul>
          )}
        </ChartPanel>
      </section>

      <section className="card jm-table-card dvt-panel" data-tour="page-jobs">
        <DataPanelToolbar
          layout={layout}
          onLayoutChange={setLayout}
          countLabel={layout === 'grid'
            ? `${filtered.length} job${filtered.length === 1 ? '' : 's'} · page ${cur} of ${pages}`
            : `${filtered.length} job${filtered.length === 1 ? '' : 's'}`}
        >
          <span className="jm-chips" role="group" aria-label="Filter by status">
            {['ALL', ...STATUS_ORDER].map((s) => (
              <button key={s} type="button" className="jm-chip" aria-pressed={status === s} onClick={() => { setStatus(s); setPage(1); }}>
                {s === 'ALL' ? `All ${stats.total}` : `${meta(s).label} ${stats.counts[s] || 0}`}
              </button>
            ))}
          </span>
          <label>Backend
            <select className="input-control" value={backend} onChange={(e) => setBackend(e.target.value)}>
              <option value="ALL">All backends</option>
              {stats.backends.map((id) => <option key={id} value={id}>{label(id)}</option>)}
            </select>
          </label>
          <label>Search
            <input type="search" value={search} placeholder="Job, calibration, reason" onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </label>
        </DataPanelToolbar>
        {layout === 'grid' ? (
          <div className="dvt-grid" aria-label="Jobs">
            {shown.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '8px 14px' }}><TableEmpty colSpan={1} title="No jobs match" message="Adjust filters or search." /></div>
            ) : shown.map((j) => (
              <article key={j.job_id} className="dvt-card" data-selected={j.job_id === selectedId || undefined}>
                <header className="dvt-card__head">
                  <div>
                    <button type="button" className="dvt-card__title jm-link" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => setSelectedId(j.job_id)}>{j.job_id}</button>
                    <p className="dvt-card__meta">{label(j.backend_id)}</p>
                  </div>
                  <StatusBadge status={j.status} />
                </header>
                <dl className="dvt-card__stats">
                  <div><dt>Submitted</dt><dd>{fmtTs(j.submitted_at)}</dd></div>
                  <div><dt>Runtime</dt><dd>{fmtDur(j.runtime)}</dd></div>
                </dl>
                {j.failure_reason && <p className="dvt-card__body">{j.failure_reason}</p>}
                <footer className="dvt-card__foot">
                  <button type="button" className="btn btn-secondary btn--xs" onClick={() => setSelectedId(j.job_id)}>Details</button>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <EnterpriseDataTable
            rows={jobTableRows}
            columns={jobTableColumns}
            searchKeys={['job_id', 'backend_id', 'backend_label', 'status', 'failure_reason']}
            searchPlaceholder="Search jobs…"
            pageSize={15}
            initialSort={{ key: 'submitted_sort', dir: 'desc' }}
            ariaLabel="Jobs"
            tableClassName="jm-table custom-table custom-table--dense"
          />
        )}
        {layout === 'grid' && (
          <div className="jm-pager">
            <span>{filtered.length} job{filtered.length === 1 ? '' : 's'} · page {cur} of {pages}</span>
            <span>
              <button type="button" className="btn btn-secondary" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>Previous</button>{' '}
              <button type="button" className="btn btn-secondary" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Next</button>
            </span>
          </div>
        )}
      </section>

      <DetailDrawer
        open={Boolean(selected)}
        tourId={selected ? 'page-job-detail' : undefined}
        title={selected ? selected.job_id : ''}
        subtitle={selected ? `${label(selected.backend_id)}${selected.runtime != null ? ` · Runtime ${fmtDur(selected.runtime)}` : ''}` : undefined}
        headerAside={selected ? <StatusBadge status={selected.status} /> : null}
        size="lg"
        onClose={() => setSelectedId(null)}
      >
        {selected && <JobDrawerBody job={selected} nav={nav} />}
      </DetailDrawer>
    </div>
  );
};
