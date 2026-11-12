import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { ViewModeToggle } from '../components/observability/DataViewToolbar.jsx';
import { PageRefreshCluster } from '../components/ui/PageRefreshCluster.jsx';
import { X } from 'lucide-react';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { api } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { STATES, ageMinutes, formatAge, isStale, lineageOf, modalityName, providerName, useProviderLineage, STALE_MIN, KNOWN_PROVIDER_IDS } from './backendUtils.js';
import { StateBar, StatusText } from './backendCommon.jsx';
import { AddBackendWizard } from './AddBackendWizard.jsx';
import { BackendPreviewDrawer } from '../components/backends/BackendPreviewDrawer.jsx';
import { MetricCard } from '../components/ds/MetricCard.jsx';
import { FilterBar } from '../components/ds/FilterBar.jsx';
import { unableToLoad } from '../constants/messages.js';
import { formatBackendTitle } from '../lib/displayLabels.js';
import './BackendInventory.css';
import './fleetShared.css';

const SORT_PRESETS = [
  { key: 'health', dir: 'desc', label: 'Health (worst first)' },
  { key: 'name', dir: 'asc', label: 'Name (A→Z)' },
  { key: 'alerts', dir: 'desc', label: 'Alerts (high first)' },
  { key: 'queue', dir: 'desc', label: 'Queue depth' },
  { key: 'age', dir: 'desc', label: 'Telemetry age' },
  { key: 'status', dir: 'asc', label: 'Status' },
];

const COLUMNS = [
  { key: 'name', label: 'Backend' },
  { key: 'owner', label: 'Owner' },
  { key: 'facility', label: 'Facility' },
  { key: 'provider', label: 'Provider' },
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
  const [f, setF] = useState({ provider: 'ALL', modality: 'ALL', status: 'ALL', source: 'ALL', facility: 'ALL' });
  const [catalogEdit, setCatalogEdit] = useState(null);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [sort, setSort] = useState({ key: 'health', dir: 'desc' });
  const [view, setView] = useState('table');
  const [preview, setPreview] = useState(null);
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
        <PageRefreshCluster onClick={load} lastRefreshAt={lastRefresh} label="Refresh inventory" />
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
      name: formatBackendTitle({ backend_id: id, backend_name: b.backend_name }),
      owner: b.owner || '—',
      facility: b.facility || '—',
      tags: Array.isArray(b.tags) ? b.tags : [],
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
      queue: q?.pending_jobs ?? null,
      wait: q?.estimated_wait_time,
      queueCondition: q?.queue_condition,
      unlisted: !KNOWN_PROVIDER_IDS.has(b.provider_id),
    };
  }), [data, lineage.map]);

  const displayRows = rows;
  const unlistedN = useMemo(() => rows.filter((r) => r.unlisted).length, [rows]);
  const hasOwner = useMemo(() => displayRows.some((r) => r.owner && r.owner !== '—'), [displayRows]);
  const hasFacility = useMemo(() => displayRows.some((r) => r.facility && r.facility !== '—'), [displayRows]);
  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => {
      if (c.key === 'owner') return hasOwner;
      if (c.key === 'facility') return hasFacility;
      return true;
    }),
    [hasOwner, hasFacility],
  );

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = displayRows.filter((r) => (
      (f.provider === 'ALL' || r.provider === f.provider)
      && (f.modality === 'ALL' || r.modality === f.modality)
      && (f.status === 'ALL' || r.status === f.status)
      && (f.source === 'ALL' || r.source === f.source)
      && (f.facility === 'ALL' || r.facility === f.facility)
      && (!needle || `${r.id} ${r.name} ${r.provider} ${r.modality} ${r.owner} ${r.facility} ${(r.tags || []).join(' ')}`.toLowerCase().includes(needle))
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

  if (fatal) return <ErrorState variant="panel" message={unableToLoad('the backend registry')} onRetry={load} />;
  if (!data) return <BoneyardSkeleton layout="table" />;

  const fleetCounts = STATES.reduce((acc, s) => ({ ...acc, [s]: displayRows.reduce((n, r) => n + (r.counts?.[s] || 0), 0) }), {});
  const fleetTotal = STATES.reduce((n, s) => n + fleetCounts[s], 0);
  const online = displayRows.filter((r) => r.status === 'ONLINE').length;
  const staleN = displayRows.filter((r) => isStale(r.age)).length;
  const openPreview = (id) => setPreview(displayRows.find((r) => r.id === id) || null);
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const filtersActive = search || Object.values(f).some((v) => v !== 'ALL');

  const renderInventoryCell = (r, key) => {
    switch (key) {
      case 'name':
        return (
          <>
            <button type="button" className="bk-link" onClick={(e) => { e.stopPropagation(); openPreview(r.id); }} aria-label={`Preview ${r.name}`}>{r.name}</button>
            <span className="bk-id" title="Technical id">{r.id}</span>
          </>
        );
      case 'owner':
        return (
          <>
            {r.owner !== '—' ? r.owner : <span className="bk-muted">Not configured</span>}
            {isAdmin && (
              <button type="button" className="bk-link" style={{ marginLeft: 6, fontSize: 11 }} onClick={(e) => { e.stopPropagation(); setCatalogEdit({ id: r.id, name: r.name, owner: r.owner === '—' ? '' : r.owner, facility: r.facility === '—' ? '' : r.facility, tags: (r.tags || []).join(', ') }); }}>Edit</button>
            )}
          </>
        );
      case 'facility':
        return r.facility !== '—' ? r.facility : <span className="bk-muted">Not configured</span>;
      case 'provider':
        return r.provider;
      case 'modality':
        return r.modality;
      case 'qubits':
        return r.qubits ?? '—';
      case 'health':
        return <StateBar counts={r.counts} label={r.name} />;
      case 'status':
        return <StatusText status={r.status} />;
      case 'age':
        return (
          <>
            {formatAge(r.age)}
            {isStale(r.age) && <div className="bk-stale">Stale</div>}
          </>
        );
      case 'alerts':
        return <span className="bk-alert-n" data-n={r.alerts ?? 0}>{r.alerts ?? '—'}</span>;
      case 'queue':
        return (
          <>
            {r.queue ?? '—'}
            {r.wait != null && <div className="bk-muted">~{Math.round(r.wait)}s wait</div>}
          </>
        );
      default:
        return '—';
    }
  };
  const select = (k, label, options) => (
    <label className="outline-field">
      <span>{label}</span>
      <select className="input-control" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
        <option value="ALL">All</option>
        {options.map((o) => <option key={o} value={o}>{k === 'source' ? (o === 'live' ? 'Live vendor' : o === 'simulated' ? 'Simulated' : 'Unknown') : o}</option>)}
      </select>
    </label>
  );

  return (
    <div className="page-stack">
      <section className="bk-summary card" aria-label="Fleet summary" data-tour="page-inventory">
        <div className="bk-summary__stats bk-summary__stats--ds">
          <MetricCard
            label="Backends"
            value={displayRows.length}
            hint={`${online} online${unlistedN ? ` · ${unlistedN} unlisted` : ''}`}
          />
          <MetricCard
            label="Active alerts"
            value={data.alertsOk ? data.alertFleetActive : null}
            hint={data.alertFleetCritical ? `${data.alertFleetCritical} critical` : 'ACTIVE status'}
            tone={data.alertFleetCritical ? 'crit' : data.alertFleetActive ? 'warn' : 'neutral'}
          />
          <MetricCard
            label="Stale telemetry"
            value={staleN}
            hint={`Last sample past ${STALE_MIN} min`}
            tone={staleN ? 'warn' : 'ok'}
          />
        </div>
        <div className="bk-summary__health">
          <span className="bk-filter-group__title">Fleet qubit health</span>
          <StateBar counts={fleetCounts} total={fleetTotal} label="Fleet qubits" />
        </div>
      </section>

      {unlistedN > 0 && (
        <p className="bk-note" role="status">
          {unlistedN} backend{unlistedN === 1 ? '' : 's'} use a provider id outside the built-in catalog — still shown here so fleet counts match the registry.
        </p>
      )}

      {(failed.length > 0 || lineage.error) && (
        <p className="bk-note" role="status">
          Partial load: {[...failed, ...(lineage.error ? ['lineage'] : [])].join(', ')}.
        </p>
      )}

      <section className="card bk-panel">
        <FilterBar
          className="bk-toolbar filter-bar--inline"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search backend, provider, modality"
          searchLabel="Search backends"
          count={`${shown.length} of ${displayRows.length}`}
          actions={(
            <ViewModeToggle value={view} onChange={setView} toggleClassName="bk-view-toggle dvt-view-toggle" btnClassName="bk-view-btn dvt-view-btn" />
          )}
        >
          {select('provider', 'Provider', uniq(displayRows, 'provider'))}
          {select('modality', 'Modality', uniq(displayRows, 'modality'))}
          {select('status', 'Status', uniq(displayRows, 'status'))}
          {select('source', 'Source', uniq(displayRows, 'source'))}
          {select('facility', 'Facility', uniq(displayRows, 'facility').filter((x) => x && x !== '—'))}
          <label className="bk-sort-pick bk-sort-pick--inline outline-field">
            <span>Sort</span>
            <select
              className="input-control"
              value={`${sort.key}:${sort.dir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(':');
                setSort({ key, dir });
              }}
            >
              {SORT_PRESETS.map((p) => (
                <option key={`${p.key}:${p.dir}`} value={`${p.key}:${p.dir}`}>{p.label}</option>
              ))}
            </select>
          </label>
          {filtersActive ? (
            <button type="button" className="btn btn-secondary btn--xs" onClick={() => { setSearch(''); setF({ provider: 'ALL', modality: 'ALL', status: 'ALL', source: 'ALL', facility: 'ALL' }); }}>Clear</button>
          ) : null}
        </FilterBar>

        {shown.length === 0 ? (
          <EmptyState variant="panel" compact title={rows.length ? 'No matches' : 'Registry empty'} message={rows.length ? 'Clear filters or change search.' : 'No backends in the registry. Check Platform health and collectors.'} />
        ) : view === 'grid' ? (
          <div className="bk-library" aria-label="Backend library">
            {shown.map((r) => (
              <article
                key={r.id}
                className={`bk-card${r.alerts ? ' bk-card--alert' : ''}${isStale(r.age) ? ' bk-card--stale' : ''}`}
              >
                <button type="button" className="bk-card__hit" onClick={() => openPreview(r.id)} aria-label={`Preview ${r.name}`}>
                  <header className="bk-card__head">
                    <div className="bk-card__title">{r.name}</div>
                    <StatusText status={r.status} />
                  </header>
                  <code className="bk-card__id">{r.id}</code>
                  <div className="bk-card__tags">
                    <span className="bk-tag">{r.modality}</span>
                    <span className="bk-tag">{r.provider}</span>
                    {r.facility !== '—' && <span className="bk-tag">{r.facility}</span>}
                    {isStale(r.age) ? <span className="bk-tag bk-tag--warn">Stale telemetry</span> : null}
                    {r.unlisted ? <span className="bk-tag bk-tag--warn">Unlisted provider</span> : null}
                  </div>
                  {(r.owner !== '—' || r.tags.length > 0) && (
                    <p className="bk-muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
                      {r.owner !== '—' ? `Owner ${r.owner}` : ''}
                      {r.tags.length ? `${r.owner !== '—' ? ' · ' : ''}${r.tags.join(', ')}` : ''}
                    </p>
                  )}
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
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn-secondary btn--xs"
                    style={{ margin: '0 12px 12px' }}
                    onClick={() => setCatalogEdit({
                      id: r.id,
                      name: r.name,
                      owner: r.owner === '—' ? '' : r.owner,
                      facility: r.facility === '—' ? '' : r.facility,
                      tags: (r.tags || []).join(', '),
                    })}
                  >
                    <Pencil size={14} aria-hidden /> Registry metadata
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="bk-tablewrap">
            <table className="bk-table">
              <caption className="bk-sr">
                Backend registry. Source (live vs demo) is in the Source filter — not repeated per row. Click a row to open its workspace.
              </caption>
              <thead>
                <tr>
                  {visibleColumns.map((c) => (
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
                  <tr key={r.id} className="bk-row" onClick={() => openPreview(r.id)}>
                    {visibleColumns.map((c) => (
                      <td key={c.key} className={c.right ? 'bk-r' : undefined}>{renderInventoryCell(r, c.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <BackendPreviewDrawer
        row={preview}
        onClose={() => setPreview(null)}
        onOpenWorkspace={onSelectBackend}
      />

      <AddBackendWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={load}
        isAdmin={isAdmin}
      />

      {catalogEdit && (
        <div className="bk-modal-backdrop" role="presentation" onClick={() => !catalogSaving && setCatalogEdit(null)}>
          <div className="bk-modal-card" role="dialog" aria-modal="true" aria-labelledby="catalog-edit-title" onClick={(e) => e.stopPropagation()}>
            <header className="bk-modal-header">
              <div>
                <h3 id="catalog-edit-title">Registry metadata</h3>
                <p className="page-hint" style={{ margin: '4px 0 0' }}>{catalogEdit.name} · <code>{catalogEdit.id}</code></p>
              </div>
              <button type="button" className="bk-modal-close" aria-label="Close" onClick={() => setCatalogEdit(null)}><X size={18} /></button>
            </header>
            <div className="bk-modal-body">
              <p className="page-hint">Owner, facility, and tags for inventory search — not vendor cloud configuration.</p>
              <label className="admin-form-field">
                <span className="admin-form-label">Owner</span>
                <input className="input-control" value={catalogEdit.owner} onChange={(e) => setCatalogEdit({ ...catalogEdit, owner: e.target.value })} />
              </label>
              <label className="admin-form-field">
                <span className="admin-form-label">Facility</span>
                <input className="input-control" value={catalogEdit.facility} onChange={(e) => setCatalogEdit({ ...catalogEdit, facility: e.target.value })} />
              </label>
              <label className="admin-form-field">
                <span className="admin-form-label">Tags (comma-separated)</span>
                <input className="input-control" value={catalogEdit.tags} onChange={(e) => setCatalogEdit({ ...catalogEdit, tags: e.target.value })} />
              </label>
            </div>
            <footer className="bk-modal-footer">
              <button type="button" className="btn btn-secondary" disabled={catalogSaving} onClick={() => setCatalogEdit(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={catalogSaving}
                onClick={async () => {
                  setCatalogSaving(true);
                  try {
                    const tags = catalogEdit.tags.split(',').map((t) => t.trim()).filter(Boolean);
                    await api.updateBackendCatalog(catalogEdit.id, {
                      owner: catalogEdit.owner.trim() || null,
                      facility: catalogEdit.facility.trim() || null,
                      tags,
                    });
                    setCatalogEdit(null);
                    await load();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setCatalogSaving(false);
                  }
                }}
              >
                {catalogSaving ? 'Saving…' : 'Save'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};
