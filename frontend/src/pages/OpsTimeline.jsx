import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { X } from 'lucide-react';
import { FilterBar } from '../components/ds/FilterBar.jsx';
import { api } from '../services/api';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { DetailDrawer } from '../components/observability/DetailDrawer.jsx';
import { DetailModalBody, DetailModalSection } from '../components/observability/DetailModalLayout.jsx';
import { TableEmpty } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { getChartTheme, baseTooltip, getSeverityChartColors, getChartSemanticColors } from '../components/observability/chartTheme.js';
import { useTheme } from '../components/ui/ThemeProvider';
import { useAppScope } from '../hooks/useAppScope.js';
import { fetchApi } from '../services/api';
import { formatIST } from '../utils/time';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { buildBackendDetailsPath } from '../lib/investigationLinks.js';
import { SevBadge, StatusBadge } from './opsShared.jsx';
import { sevRank, toMs } from './opsHelpers.js';
import { SortableTh, ViewModeToggle } from '../components/observability/DataViewToolbar.jsx';
import { ListPager } from '../components/observability/ListPager.jsx';
import './OpsTimeline.css';

const LIMIT = 500; // alerts/incidents/collector failures are each capped server-side by this
const KINDS = ['alert', 'incident', 'collector_failure'];
const KIND_SYMBOL = { alert: 'circle', incident: 'diamond', collector_failure: 'triangle' };
const ROWS = 25;

export const OpsTimeline = () => {
  const nav = useNavigate();
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const t = getChartTheme(isDark);
  const { backend: scopeBackend, setBackend, alertId, setAlertId } = useAppScope();
  const [sp, setSp] = useSearchParams();
  const at = sp.get('at') || '';
  const { setActions, clearActions } = usePageActions();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [kinds, setKinds] = useState(() => new Set(KINDS));
  const [sev, setSev] = useState('ALL');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [selected, setSelected] = useState(null); // lane|at bucket key
  const [page, setPage] = useState(1);
  const [layout, setLayout] = useState('table');
  const [sort, setSort] = useState({ key: 'at', dir: 'desc' });
  const [backends, setBackends] = useState([]);

  const load = useCallback(() => {
    fetchApi(`/operations/timeline?limit=${LIMIT}`)
      .then((r) => { setEvents(r?.events || []); setError(null); setLastRefresh(new Date()); })
      .catch((e) => setError(e?.message || 'Request failed'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let cancelled = false;
    api.getBackends().then((list) => { if (!cancelled) setBackends(list || []); }).catch(() => { if (!cancelled) setBackends([]); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh timeline" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);
  useEffect(() => setPage(1), [kinds, sev, debouncedQuery, scopeBackend, alertId]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return events.filter((e) => (
      kinds.has(e.kind)
      && (sev === 'ALL' || e.severity === sev)
      && (!scopeBackend || !e.backend_id || e.backend_id === scopeBackend)
      && (!alertId || e.id === alertId || e.correlation_id === alertId)
      && (!q || [e.title, e.summary, e.id, e.backend_id].some((f) => String(f || '').toLowerCase().includes(q)))
    ));
  }, [events, kinds, sev, scopeBackend, alertId, debouncedQuery]);

  const sorted = useMemo(() => {
    const list = filtered.slice();
    const mul = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let c = 0;
      if (sort.key === 'severity') c = sevRank(a.severity) - sevRank(b.severity);
      else if (sort.key === 'kind') c = String(a.kind).localeCompare(String(b.kind));
      else if (sort.key === 'backend') c = String(a.backend_id || '').localeCompare(String(b.backend_id || ''));
      else c = (toMs(a.at) ?? 0) - (toMs(b.at) ?? 0);
      return c * mul;
    });
    return list;
  }, [filtered, sort]);

  const eventPages = Math.max(1, Math.ceil(sorted.length / ROWS));
  const eventPage = Math.min(page, eventPages);
  const pageEvents = sorted.slice((eventPage - 1) * ROWS, eventPage * ROWS);

  // lanes = backend · kind; events at identical timestamp share a bucket (batch detections)
  const { lanes, buckets } = useMemo(() => {
    const map = new Map();
    filtered.forEach((e) => {
      const lane = `${e.backend_id || 'fleet'} · ${e.kind.replace('_', ' ')}`;
      const key = `${lane}|${e.at}`;
      if (!map.has(key)) map.set(key, { key, lane, kind: e.kind, at: e.at, ms: toMs(e.at), items: [] });
      map.get(key).items.push(e);
    });
    const b = [...map.values()].map((x) => ({
      ...x,
      worst: [...x.items].sort((p, q) => sevRank(p.severity) - sevRank(q.severity))[0].severity,
    }));
    return { lanes: [...new Set(b.map((x) => x.lane))].sort(), buckets: b };
  }, [filtered]);

  const bucketByKey = useMemo(() => new Map(buckets.map((b) => [b.key, b])), [buckets]);
  const sel = selected ? bucketByKey.get(selected) : null;
  const atMs = toMs(at);

  const span = useMemo(() => {
    const ms = buckets.map((b) => b.ms).filter((m) => m != null);
    if (!ms.length) return {};
    const lo = Math.min(...ms); const hi = Math.max(...ms);
    const pad = Math.max((hi - lo) * 0.06, 60000);
    return { min: lo - pad, max: hi + pad };
  }, [buckets]);

  const option = useMemo(() => {
    const sevColor = getSeverityChartColors();
    const sem = getChartSemanticColors();
    return {
    grid: { left: 230, right: 28, top: 16, bottom: 56 },
    tooltip: {
      ...baseTooltip(isDark), trigger: 'item',
      formatter: (p) => {
        const b = p.data.bucket;
        return `<b>${b.lane}</b><br/>${formatIST(b.at)}<br/>${b.items.length} event(s) · worst ${b.worst}<br/><i>Click for details</i>`;
      },
    },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8, textStyle: { color: t.textColor } }],
    xAxis: { type: 'time', ...span, axisLabel: { color: t.textColor }, axisLine: { lineStyle: { color: t.axisLine } }, splitLine: { lineStyle: { color: t.splitColor } } },
    yAxis: { type: 'category', data: lanes, inverse: true, axisLabel: { color: t.textColor, width: 210, overflow: 'truncate' }, axisLine: { lineStyle: { color: t.axisLine } }, splitLine: { show: true, lineStyle: { color: t.splitColor } } },
    series: [{
      type: 'scatter',
      data: buckets.map((b) => ({
        value: [b.ms, b.lane],
        bucket: b,
        symbol: KIND_SYMBOL[b.kind] || 'circle',
        symbolSize: Math.min(36, 12 + Math.sqrt(b.items.length) * 4),
        itemStyle: { color: sevColor[b.worst] || sevColor.INFO, borderColor: b.key === selected ? t.tooltipText : 'transparent', borderWidth: 2, opacity: 0.9 },
      })),
      markLine: atMs ? { silent: true, symbol: 'none', lineStyle: { color: sem.info, type: 'dashed' }, label: { formatter: 'focus', color: t.textColor }, data: [{ xAxis: atMs }] } : undefined,
    }],
  };
  }, [buckets, lanes, selected, atMs, isDark, t, span]);

  const toggleKind = (k) => setKinds((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const clearAt = () => setSp((p) => { const n = new URLSearchParams(p); n.delete('at'); return n; }, { replace: true });
  const reset = () => { setKinds(new Set(KINDS)); setSev('ALL'); setQuery(''); setBackend(''); setAlertId(''); clearAt(); };

  const linkFor = (e) => (e.kind === 'incident'
    ? { label: 'Open incident', to: { pathname: '/app/alerts/incidents' } }
    : e.kind === 'alert'
      ? { label: 'Open alert', to: { pathname: '/app/alerts', search: `?alert=${encodeURIComponent(e.id)}` } }
      : null);

  if (loading) return <BoneyardSkeleton layout="timeline" />;
  if (error && !events.length) return <ErrorState message={error} onRetry={load} />;

  const state = events.length === 0 ? 'empty' : filtered.length === 0 ? 'empty' : 'ready';
  const kindCounts = KINDS.map((k) => [k, events.filter((e) => e.kind === k).length]);

  return (
    <div className="page-stack ops-tl">
      {error && <p className="ot-note ot-note--warn" role="alert">Refresh failed: {error}. Showing previous data.</p>}

      <FilterBar
        className="card ot-filter-bar filter-bar--inline"
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search title, id…"
        searchLabel="Search events"
        count={`${filtered.length} of ${events.length} events`}
        actions={(
          <>
            {atMs && (
              <button type="button" className="btn btn-secondary btn--xs" onClick={clearAt} title={`Clear time focus ${formatIST(at)}`}>
                <X size={12} aria-hidden /> Clear time focus
              </button>
            )}
            <button type="button" className="btn btn-secondary btn--xs" onClick={reset}>Reset</button>
            <ViewModeToggle value={layout} onChange={setLayout} />
          </>
        )}
      >
        <label className="ot-filter-field">
          Backend
          <select className="input-control" value={scopeBackend || ''} onChange={(e) => setBackend(e.target.value)} aria-label="Backend scope">
            <option value="">All backends</option>
            {backends.map((b) => (
              <option key={b.backend_id} value={b.backend_id}>{b.backend_name || b.backend_id}</option>
            ))}
          </select>
        </label>
        <div className="ot-kinds" role="group" aria-label="Event types">
          {kindCounts.map(([k, n]) => (
            <button key={k} type="button" className="ot-chip" aria-pressed={kinds.has(k)} onClick={() => toggleKind(k)}>
              <span className={`ot-glyph ot-glyph--${k}`} aria-hidden /> {k.replace('_', ' ')} ({n})
            </button>
          ))}
        </div>
        <label className="ot-filter-field">
          Severity
          <select className="input-control" value={sev} onChange={(e) => setSev(e.target.value)}>
            <option value="ALL">All</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>
        </label>
        {alertId ? (
          <span className="ot-alert-pill" title="Scoped from URL">
            Alert <code>{alertId}</code>
            <button type="button" className="btn btn-secondary btn--xs" onClick={() => setAlertId('')}>Clear</button>
          </span>
        ) : null}
      </FilterBar>

      <ChartPanel
        title="Event swim-lanes"
        titleTo="/app/alerts"
        question="Chronological view by backend and event type."
        help="One lane per backend and event type. Marker shape = type (circle alert, diamond incident, triangle collector failure); colour = worst severity in the marker; size = events at the same instant. Click a marker for details."
        sourceKind="live"
        asOf={lastRefresh?.toISOString()}
        state={state}
        emptyTitle={events.length === 0 ? 'Timeline empty' : 'No matching events'}
        emptyMessage={events.length === 0 ? 'No alerts, incidents, or collector events on record.' : 'Filters exclude all events. Reset filters to view all.'}
        minHeight={Math.max(220, lanes.length * 52 + 90)}
      >
        <QtECharts
          option={option}
          style={{ height: Math.max(220, lanes.length * 52 + 90) }}
          onEvents={{ click: (p) => p?.data?.bucket && setSelected(p.data.bucket.key) }}
        />
      </ChartPanel>
      <section className="card ot-table dvt-panel" aria-label="Events">
        {layout === 'grid' ? (
          <div className="dvt-grid">
            {sorted.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '8px 14px' }}><TableEmpty colSpan={1} title={events.length === 0 ? 'Timeline empty' : 'No matching events'} message={events.length === 0 ? 'Nothing recorded yet.' : 'Adjust filters.'} /></div>
            ) : pageEvents.map((e) => {
              const key = `${e.backend_id || 'fleet'} · ${e.kind.replace('_', ' ')}|${e.at}`;
              return (
                <article key={`${e.kind}-${e.id}`} className="dvt-card" data-selected={selected === key || undefined}>
                  <header className="dvt-card__head">
                    <div>
                      <h4 className="dvt-card__title">{e.title || e.summary || e.kind}</h4>
                      <p className="dvt-card__meta">{formatIST(e.at, false)} · {e.backend_id || 'fleet'}</p>
                    </div>
                    <SevBadge severity={e.severity} />
                  </header>
                  <p className="dvt-card__body">{e.kind.replace('_', ' ')}{e.status ? ` · ${e.status}` : ''}</p>
                  <footer className="dvt-card__foot">
                    <button type="button" className="btn btn-secondary btn--xs" onClick={() => setSelected(key)}>Details</button>
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <SortableTh sort={sort} sortKey="at" onToggle={setSort} defaultDir="desc">When (IST)</SortableTh>
                  <SortableTh sort={sort} sortKey="kind" onToggle={setSort} defaultDir="asc">Type</SortableTh>
                  <SortableTh sort={sort} sortKey="severity" onToggle={setSort} defaultDir="asc">Severity</SortableTh>
                  <th>Title</th>
                  <SortableTh sort={sort} sortKey="backend" onToggle={setSort} defaultDir="asc">Backend</SortableTh>
                  <th>Status</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <TableEmpty colSpan={7} title={events.length === 0 ? 'Timeline empty' : 'No matching events'} message={events.length === 0 ? 'Nothing recorded yet.' : 'Adjust filters.'} />
                ) : pageEvents.map((e) => {
                  const key = `${e.backend_id || 'fleet'} · ${e.kind.replace('_', ' ')}|${e.at}`;
                  return (
                    <tr key={`${e.kind}-${e.id}`} className={selected === key ? 'ot-row--sel' : undefined}>
                      <td className="ot-nowrap">{formatIST(e.at, false)}</td>
                      <td>{e.kind.replace('_', ' ')}</td>
                      <td><SevBadge severity={e.severity} /></td>
                      <td>{e.title || e.summary || 'N/A'}</td>
                      <td>{e.backend_id || 'N/A'}</td>
                      <td>{e.status ? <StatusBadge status={e.status} /> : 'N/A'}</td>
                      <td><button type="button" className="btn btn-secondary btn--xs" onClick={() => setSelected(key)}>Details</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <ListPager page={eventPage} pages={eventPages} onPage={setPage} />
      </section>

      <DetailDrawer
        open={!!sel}
        onClose={() => setSelected(null)}
        title={sel ? `${sel.items.length} event${sel.items.length === 1 ? '' : 's'}` : 'Events'}
        subtitle={sel ? `${sel.lane} · ${formatIST(sel.at)}` : undefined}
        size="lg"
      >
        {sel && (
          <DetailModalBody>
            <DetailModalSection title="Events at this time">
              <ul className="ot-list">
                {[...sel.items].sort((a, b) => sevRank(a.severity) - sevRank(b.severity)).map((e) => {
                  const l = linkFor(e);
                  return (
                    <li key={`${e.kind}-${e.id}`}>
                      <div className="ot-list__head"><SevBadge severity={e.severity} />{e.status && <StatusBadge status={e.status} />}</div>
                      <div>{e.title}</div>
                      <div className="ot-list__id">{e.id}</div>
                      {l && <button type="button" className="btn btn-secondary btn--xs" onClick={() => nav(l.to)}>{l.label}</button>}
                    </li>
                  );
                })}
              </ul>
            </DetailModalSection>
            {sel.items[0].backend_id && (
              <DetailModalSection title="Investigate">
                <button type="button" className="btn btn-primary" onClick={() => nav(buildBackendDetailsPath(sel.items[0].backend_id))}>Open backend workspace</button>
              </DetailModalSection>
            )}
          </DetailModalBody>
        )}
      </DetailDrawer>
    </div>
  );
};
