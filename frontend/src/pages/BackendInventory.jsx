import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ViewModeToggle } from '../components/observability/DataViewToolbar.jsx';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { api } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { STATES, ageMinutes, formatAge, isStale, lineageOf, modalityName, providerName, useProviderLineage, STALE_MIN, KNOWN_PROVIDER_IDS } from './backendUtils.js';
import { LineageTag, StateBar, StatusText } from './backendCommon.jsx';
import { AddBackendWizard } from './AddBackendWizard.jsx';
import './BackendInventory.css';
import './fleetShared.css';

const COLUMNS = [
  { key: 'name', label: 'Backend' },
  { key: 'provider', label: 'Provider · source' },
  { key: 'modality', label: 'Modality' },
  { key: 'qubits', label: 'Qubits', right: true },
  { key: 'health', label: 'Qubit health' },
  { key: 'status', label: 'Status' },
  { key: 'age', label: 'Last telemetry', right: true },
  { key: 'alerts', label: 'Alerts', right: true },
  { key: 'queue', label: 'Queue', right: true },
];

const uniq = (rows, k) => [...new Set(rows.map((r) => r[k]))].sort();

export const BackendInventory = ({ onSelectBackend, isAdmin = false }) => {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState([]);
  const [fatal, setFatal] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [search, setSearch] = useState('');
  const [f, setF] = useState({ provider: 'ALL', modality: 'ALL', status: 'ALL', source: 'ALL' });
  const [sort, setSort] = useState({ key: 'health', dir: 'desc' });
  const [view, setView] = useState('grid');
  const [wizardOpen, setWizardOpen] = useState(false);
  const { setActions, clearActions } = usePageActions();
  const lineage = useProviderLineage();

  const load = useCallback(async () => {
    setFatal(false);
    const backends = await api.getBackends().catch(() => null);
    if (!backends) { setFatal(true); return; }
    const [hv, queues, alertSummary, statusAll] = await Promise.allSettled([
      api.getHealthVector(),
      api.getQueues(),
      api.getAlertsSummary(),
      api.getBackendsStatusAll(),
    ]);
    const bad = [];
    const val = (r, name) => { if (r.status === 'fulfilled') return r.value; bad.push(name); return null; };
    const hvMap = Object.fromEntries((val(hv, 'qubit health')?.backends || []).map((b) => [b.backend_id, b]));
    const qMap = Object.fromEntries((val(queues, 'queues') || []).map((q) => [q.backend_id, q]));
    const summaryVal = val(alertSummary, 'alerts');
    const alertN = summaryVal?.by_backend || {};
    const stMap = Object.fromEntries((val(statusAll, 'telemetry age') || []).map((s) => [s.backend_id, s]));
    if (statusAll.status === 'rejected') bad.push('telemetry age');
    setData({
      backends,
      hvMap,
      qMap,
      alertN,
      stMap,
      alertsOk: alertSummary.status === 'fulfilled' && summaryVal != null,
      alertFleetActive: summaryVal?.active ?? null,
      alertFleetCritical: summaryVal?.critical ?? null,
    });
    setFailed([...new Set(bad)]);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setActions((
      <>
        <button type="button" className="btn btn-primary" onClick={() => setWizardOpen(true)}>
          <Plus size={15} aria-hidden /> Add backend
        </button>
        <RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh inventory" />
      </>
    ));
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  const rows = useMemo(() => (data?.backends || []).map((b) => {
    const id = b.backend_id;
    const hv = data.hvMap[id];
    const age = ageMinutes(data.stMap[id]?.updated_at);
    const q = data.qMap[id];
    return {
      id,
      name: b.backend_name,
      provider: providerName(b.provider_id),
      providerId: b.provider_id,
      source: lineageOf(lineage.map, b.provider_id),
      modality: modalityName(b.qpu_modality),
      qubits: b.qubit_count,
      counts: hv?.counts || null,
      red: hv?.counts?.RED || 0,
      health: hv?.counts ? (hv.counts.RED || 0) * 1e6 + (hv.counts.YELLOW || 0) : null,
      status: b.operational_status || 'UNKNOWN',
      age,
      alerts: data.alertsOk ? data.alertN[id] || 0 : null,
      queue: q ? q.pending_jobs : null,
      wait: q?.estimated_wait_time,
      queueCondition: q?.queue_condition,
    };
  }), [data, lineage.map]);

  const displayRows = useMemo(
    () => rows.filter((r) => KNOWN_PROVIDER_IDS.has(r.providerId)),
    [rows],
  );

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = displayRows.filter((r) => (
      (f.provider === 'ALL' || r.provider === f.provider)
      && (f.modality === 'ALL' || r.modality === f.modality)
      && (f.status === 'ALL' || r.status === f.status)
      && (f.source === 'ALL' || r.source === f.source)
      && (!needle || `${r.id} ${r.name} ${r.provider} ${r.modality}`.toLowerCase().includes(needle))
    ));
    const { key, dir } = sort;
    const sign = dir === 'asc' ? 1 : -1;
    // nulls sort last in both directions
    return [...list].sort((a, b) => {
      const av = a[key]; const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sign * (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true }));
    });
  }, [displayRows, f, search, sort]);

  if (fatal) return <ErrorState variant="panel" message="Backend registry failed to load." onRetry={load} />;
  if (!data) return <BoneyardSkeleton layout="table" />;

  const fleetCounts = STATES.reduce((acc, s) => ({ ...acc, [s]: displayRows.reduce((n, r) => n + (r.counts?.[s] || 0), 0) }), {});
  const fleetTotal = STATES.reduce((n, s) => n + fleetCounts[s], 0);
  const online = displayRows.filter((r) => r.status === 'ONLINE').length;
  const staleN = displayRows.filter((r) => isStale(r.age)).length;
  const alertTotal = data.alertsOk ? displayRows.reduce((n, r) => n + r.alerts, 0) : null;
  const tally = (k) => Object.entries(displayRows.reduce((m, r) => ({ ...m, [r[k]]: (m[r[k]] || 0) + 1 }), {}));
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const filtersActive = search || Object.values(f).some((v) => v !== 'ALL');
  const select = (k, label, options) => (
    <label>{label}
      <select className="input-control" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
        <option value="ALL">All</option>
        {options.map((o) => <option key={o} value={o}>{k === 'source' ? (o === 'live' ? 'Live vendor' : o === 'simulated' ? 'Simulated' : 'Unknown') : o}</option>)}
      </select>
    </label>
  );

  return (
    <div className="page-stack">
      <section className="bk-summary card" aria-label="Fleet summary" data-tour="page-inventory">
        <div className="bk-summary__stats">
          <div className="bk-stat">
            <span className="bk-stat__label">Backends</span>
            <span className="bk-stat__value">{displayRows.length}</span>
            <span className="bk-stat__hint">{online} online</span>
          </div>
          <div className={`bk-stat${data.alertFleetCritical ? ' bk-stat--crit' : alertTotal ? ' bk-stat--warn' : ''}`}>
            <span className="bk-stat__label">Alerts</span>
            <span className="bk-stat__value">{alertTotal ?? data.alertFleetActive ?? '—'}</span>
            {data.alertFleetCritical ? (
              <span className="bk-stat__hint">{data.alertFleetCritical} critical</span>
            ) : null}
          </div>
          <div className={`bk-stat${staleN ? ' bk-stat--warn' : ''}`}>
            <span className="bk-stat__label">Stale</span>
            <span className="bk-stat__value">{staleN}</span>
            <span className="bk-stat__hint">&gt;{STALE_MIN}m</span>
          </div>
        </div>
        <div className="bk-summary__filters">
          <div className="bk-filter-group">
            <span className="bk-filter-group__title">Modality</span>
            <div className="bk-chips">
              {tally('modality').map(([k, n]) => (
                <button
                  key={k}
                  type="button"
                  className="bk-chip"
                  aria-pressed={f.modality === k}
                  onClick={() => setF((prev) => ({ ...prev, modality: prev.modality === k ? 'ALL' : k }))}
                >
                  <span className="bk-chip__name">{k}</span>
                  <span className="bk-chip__n">{n}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="bk-filter-group">
            <span className="bk-filter-group__title">Provider</span>
            <div className="bk-chips">
              {tally('provider').map(([k, n]) => {
                const provRows = displayRows.filter((x) => x.provider === k);
                const sources = [...new Set(provRows.map((r) => r.source))];
                const lineageKey = sources.length === 1 ? sources[0] : 'unknown';
                return (
                  <button
                    key={k}
                    type="button"
                    className="bk-chip bk-chip--provider"
                    aria-pressed={f.provider === k}
                    onClick={() => setF((prev) => ({ ...prev, provider: prev.provider === k ? 'ALL' : k }))}
                  >
                    <span className="bk-chip__name">{k}</span>
                    <span className="bk-chip__n">{n}</span>
                    <LineageTag lineage={lineageKey} compact />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="bk-summary__health">
          <span className="bk-filter-group__title">Fleet qubit health</span>
          <StateBar counts={fleetCounts} total={fleetTotal} label="Fleet qubits" />
        </div>
      </section>

      {(failed.length > 0 || lineage.error) && (
        <p className="bk-note" role="status">
          Partial load: {[...failed, ...(lineage.error ? ['lineage'] : [])].join(', ')}.
        </p>
      )}

      <section className="card bk-panel">
        <div className="bk-toolbar" role="search">
          <input type="search" placeholder="Search backend, provider, modality" aria-label="Search backends" value={search} onChange={(e) => setSearch(e.target.value)} />
          {select('provider', 'Provider', uniq(displayRows, 'provider'))}
          {select('modality', 'Modality', uniq(displayRows, 'modality'))}
          {select('status', 'Status', uniq(displayRows, 'status'))}
          {select('source', 'Source', uniq(displayRows, 'source'))}
          {filtersActive && (
            <button type="button" className="btn btn-secondary" onClick={() => { setSearch(''); setF({ provider: 'ALL', modality: 'ALL', status: 'ALL', source: 'ALL' }); }}>Clear filters</button>
          )}
          <ViewModeToggle value={view} onChange={setView} toggleClassName="bk-view-toggle dvt-view-toggle" btnClassName="bk-view-btn dvt-view-btn" />
          <span className="bk-muted bk-toolbar__count" aria-live="polite">{shown.length} of {displayRows.length} backends</span>
        </div>

        {shown.length === 0 ? (
          <EmptyState variant="panel" compact title={rows.length ? 'No matches' : 'Registry empty'} message={rows.length ? 'Clear filters or change search.' : 'No backends in the registry. Check Platform health and collectors.'} />
        ) : view === 'grid' ? (
          <div className="bk-library" aria-label="Backend library">
            {shown.map((r) => (
              <article
                key={r.id}
                className={`bk-card${r.alerts ? ' bk-card--alert' : ''}${isStale(r.age) ? ' bk-card--stale' : ''}`}
              >
                <button type="button" className="bk-card__hit" onClick={() => onSelectBackend?.(r.id)} aria-label={`Open ${r.name}`}>
                  <header className="bk-card__head">
                    <div className="bk-card__title">{r.name}</div>
                    <StatusText status={r.status} />
                  </header>
                  <code className="bk-card__id">{r.id}</code>
                  <div className="bk-card__tags">
                    <span className="bk-tag">{r.modality}</span>
                    <span className="bk-tag">{r.provider}</span>
                    <LineageTag lineage={r.source} />
                  </div>
                  <div className="bk-card__metrics">
                    <div><span className="bk-muted">Qubits</span><strong>{r.qubits ?? '—'}</strong></div>
                    <div><span className="bk-muted">Queue</span><strong>{r.queue ?? '—'}</strong></div>
                    <div><span className="bk-muted">Alerts</span><strong className="bk-alert-n" data-n={r.alerts ?? 0}>{r.alerts ?? '—'}</strong></div>
                    <div><span className="bk-muted">Telemetry</span><strong>{formatAge(r.age)}{isStale(r.age) ? ' · stale' : ''}</strong></div>
                  </div>
                  <div className="bk-card__health">
                    <span className="bk-muted">Qubit health</span>
                    <StateBar counts={r.counts} label={r.name} />
                  </div>
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="bk-tablewrap">
            <table className="bk-table">
              <caption className="bk-sr">Backend registry. Click a row to open its workspace.</caption>
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} scope="col" className={c.right ? 'bk-r' : undefined} aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className="bk-th" data-active={sort.key === c.key} onClick={() => toggleSort(c.key)}>
                        {c.label}<span aria-hidden>{sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="bk-row" onClick={() => onSelectBackend?.(r.id)}>
                    <td>
                      <button type="button" className="bk-link" onClick={(e) => { e.stopPropagation(); onSelectBackend?.(r.id); }} aria-label={`Open workspace for ${r.name}`}>{r.name}</button>
                      <span className="bk-id">{r.id}</span>
                    </td>
                    <td>{r.provider}<div style={{ marginTop: 3 }}><LineageTag lineage={r.source} /></div></td>
                    <td>{r.modality}</td>
                    <td className="bk-r">{r.qubits ?? '—'}</td>
                    <td><StateBar counts={r.counts} label={r.name} /></td>
                    <td><StatusText status={r.status} /></td>
                    <td className="bk-r">
                      {formatAge(r.age)}
                      {isStale(r.age) && <div className="bk-stale">Stale</div>}
                    </td>
                    <td className="bk-r"><span className="bk-alert-n" data-n={r.alerts ?? 0}>{r.alerts ?? '—'}</span></td>
                    <td className="bk-r">
                      {r.queue ?? '—'}
                      {r.wait != null && <div className="bk-muted">~{Math.round(r.wait)}s wait</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AddBackendWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={load}
        isAdmin={isAdmin}
      />
    </div>
  );
};
