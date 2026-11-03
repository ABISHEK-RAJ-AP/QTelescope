import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import ListViewToolbar from '../components/ListViewToolbar.jsx';
import AdaptiveListView from '../components/AdaptiveListView.jsx';
import { ConfirmDialog, EmptyState, KpiStrip, SortTh } from '../components/ui.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';
import { formatWindow, fromLocalInput, localTimeZone, matchQuery, nextSort, projectOptionLabel, sortBy, toLocalInput } from '../lib/format.js';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'requested', label: 'Requested' },
  { id: 'active', label: 'Active' },
  { id: 'released', label: 'Released' },
  { id: 'cancelled', label: 'Cancelled' },
];

const COLS = [
  { id: 'state', label: 'State' },
  { id: 'resource', label: 'Resource' },
  { id: 'window', label: 'Window' },
  { id: 'project', label: 'Project', defaultHidden: true },
  { id: 'purpose', label: 'Purpose' },
  { id: 'actor', label: 'Requested by', defaultHidden: true },
  { id: 'created', label: 'Created', defaultHidden: true },
  { id: 'conflict', label: 'Conflict' },
  { id: 'actions', label: 'Actions' },
];

function stateClass(state) {
  if (state === 'active') return 'govern-status govern-status--ok';
  if (state === 'cancelled') return 'govern-status govern-status--bad';
  if (state === 'released') return 'govern-status';
  return 'govern-status govern-status--warn';
}

function defaultWindow() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    window_start: toLocalInput(start.toISOString()),
    window_end: toLocalInput(end.toISOString()),
  };
}

function dayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString();
}

export default function Reservations({ onOpen, permissions = [] }) {
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('list');
  const [sort, setSort] = useState({ key: 'window_start', dir: 'asc' });
  const [form, setForm] = useState({
    resource_ref: '',
    project_id: '',
    purpose: '',
    ...defaultWindow(),
  });
  const canManage = permissions.includes('reservations:manage') || permissions.includes('platform:manage');
  const prefs = useTablePrefs('reservations', COLS);
  const tz = localTimeZone();

  function load() {
    setLoading(true);
    setError('');
    return Promise.all([
      api('/reservations'),
      api('/inventory/assets').catch(() => ({ items: [] })),
      api('/projects').catch(() => []),
    ])
      .then(([body, inventory, projectRows]) => {
        setItems(body.items || []);
        setAssets(inventory.items || []);
        setProjects(Array.isArray(projectRows) ? projectRows : projectRows.items || []);
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function createReservation(event) {
    event.preventDefault();
    setNotice('');
    setBusy(true);
    try {
      const row = await api('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          window_start: fromLocalInput(form.window_start),
          window_end: fromLocalInput(form.window_end),
        }),
      });
      setNotice(row.has_conflict ? 'Reservation requested. Overlaps an existing hold on this resource.' : 'Reservation requested.');
      setForm({ resource_ref: '', project_id: '', purpose: '', ...defaultWindow() });
      await load();
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function transition(id, state) {
    setNotice('');
    setBusy(true);
    try {
      await api(`/reservations/${encodeURIComponent(id)}/transition`, {
        method: 'POST',
        body: JSON.stringify({ state }),
      });
      setNotice(`Reservation ${state}.`);
      setPending(null);
      await load();
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(() => {
    const rows = items
      .filter((row) => !filter || row.state === filter)
      .filter((row) => matchQuery(query, row.resource_ref, row.purpose, row.state, row.project_id, row.created_by));
    return sortBy(rows, sort.key, sort.dir, (row) => {
      if (sort.key === 'window_start') return row.window_start || '';
      if (sort.key === 'created_at') return row.created_at || '';
      return row[sort.key];
    });
  }, [items, filter, query, sort]);

  const calendar = useMemo(() => {
    const groups = new Map();
    visible.forEach((row) => {
      const key = dayKey(row.window_start);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return [...groups.entries()];
  }, [visible]);

  const conflictCount = items.filter((row) => row.has_conflict).length;

  return (
    <GovernPageShell
      eyebrow="Governance"
      title="Reservations"
      subtitle={`Institutional hold windows. Timezone ${tz}. A hold is not dispatch authorization. File-backed until the programme DB migration.`}
      loading={loading && items.length === 0}
      error={error}
      notice={notice}
      onRetry={load}
      onOpen={onOpen}
      loadingLabel="Loading reservations…"
    >
      {items.length > 0 ? (
        <KpiStrip
          items={[
            ...['requested', 'active', 'released', 'cancelled'].map((state) => ({
              key: state,
              label: state,
              value: items.filter((row) => row.state === state).length,
              hint: 'Filter',
              onClick: () => setFilter(state),
            })),
            {
              key: 'conflicts',
              label: 'Conflicts',
              value: conflictCount,
              hint: 'Overlapping holds',
              tone: conflictCount ? 'govern-kpi--tone-warn' : '',
              onClick: () => setQuery(''),
            },
          ]}
        />
      ) : null}

      <p className="govern-muted">
        Lifecycle: requested → active → released. Cancel is allowed from requested or active. Released and cancelled are terminal.
      </p>

      {canManage && (
        <form className="qre-card dashboard-card govern-stack" onSubmit={createReservation}>
          <h3 className="dashboard-card-title">New reservation</h3>
          <div className="govern-form-grid">
            <label className="qre-field">
              <span className="qre-field__label">Resource</span>
              {assets.length ? (
                <select
                  className="qre-field__input"
                  required
                  value={form.resource_ref}
                  onChange={(e) => setForm({ ...form, resource_ref: e.target.value })}
                >
                  <option value="">Select registered asset…</option>
                  {assets.map((asset) => (
                    <option key={asset.asset_id} value={asset.asset_id}>
                      {asset.native_asset_id} · {asset.execution_class} · {asset.provider_id}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="qre-field__input"
                  required
                  value={form.resource_ref}
                  onChange={(e) => setForm({ ...form, resource_ref: e.target.value })}
                  placeholder="asset_id or pool id"
                />
              )}
            </label>
            <label className="qre-field">
              <span className="qre-field__label">Project (optional)</span>
              {projects.length ? (
                <select
                  className="qre-field__input"
                  value={form.project_id}
                  onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.project_id} value={project.project_id}>
                      {projectOptionLabel(project)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="qre-field__input govern-mono"
                  value={form.project_id}
                  onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                />
              )}
            </label>
            <label className="qre-field">
              <span className="qre-field__label">Window start</span>
              <input
                className="qre-field__input"
                type="datetime-local"
                required
                value={form.window_start}
                onChange={(e) => setForm({ ...form, window_start: e.target.value })}
              />
            </label>
            <label className="qre-field">
              <span className="qre-field__label">Window end</span>
              <input
                className="qre-field__input"
                type="datetime-local"
                required
                value={form.window_end}
                onChange={(e) => setForm({ ...form, window_end: e.target.value })}
              />
            </label>
          </div>
          <label className="qre-field">
            <span className="qre-field__label">Purpose</span>
            <textarea
              className="qre-field__input"
              rows={2}
              required
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            />
          </label>
          <button type="submit" className="qre-btn qre-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Request reservation'}
          </button>
        </form>
      )}

      <div className="qre-card dashboard-card">
        <div className="page-filters govern-toolbar">
          <div className="qre-tabs page-filters__grow" role="tablist" aria-label="Reservation state" style={{ marginBottom: 0, borderBottom: 'none' }}>
            {FILTERS.map((tab) => (
              <button
                key={tab.id || 'all'}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                className={`qre-tab${filter === tab.id ? ' qre-tab--active' : ''}`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="qre-tabs" role="tablist" aria-label="Reservation view" style={{ marginBottom: 0, borderBottom: 'none' }}>
            <button type="button" className={`qre-tab${view === 'list' ? ' qre-tab--active' : ''}`} onClick={() => setView('list')}>
              List
            </button>
            <button type="button" className={`qre-tab${view === 'calendar' ? ' qre-tab--active' : ''}`} onClick={() => setView('calendar')}>
              Calendar
            </button>
          </div>
          <input
            className="govern-search"
            type="search"
            placeholder="Resource, purpose, project…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Find hold"
          />
          <ListViewToolbar prefs={prefs} columns={COLS} lockedIds={['state', 'resource']} />
        </div>
        {visible.length === 0 ? (
          <EmptyState
            title={items.length ? 'No holds in this filter' : 'No reservations'}
            hint={
              items.length
                ? 'Clear the tab to see every hold, or request a new window above.'
                : 'Create a hold when a project needs exclusive access to a registered resource.'
            }
            action={
              <>
                {filter ? (
                  <button type="button" className="qre-btn qre-btn--ghost" onClick={() => setFilter('')}>
                    Show all holds
                  </button>
                ) : null}
                <button type="button" className="qre-btn qre-btn--primary" onClick={() => onOpen?.('#/inventory')}>
                  Open inventory
                </button>
              </>
            }
          />
        ) : view === 'calendar' ? (
          <div className="govern-cal">
            {calendar.map(([day, rows]) => (
              <section key={day} className="govern-cal__day" aria-label={day}>
                <h4>{day}</h4>
                <ul className="govern-cal__list">
                  {rows.map((row) => (
                    <li key={row.reservation_id} className={`govern-cal__item${row.has_conflict ? ' govern-cal__item--conflict' : ''}`}>
                      <div>
                        <strong>{row.resource_ref}</strong>
                        <div className="govern-muted">
                          {formatWindow(row.window_start)} → {formatWindow(row.window_end)}
                        </div>
                        <div>{row.purpose}</div>
                      </div>
                      <span className={stateClass(row.state)}>{row.state}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <AdaptiveListView
            prefs={prefs}
            items={visible}
            columns={COLS}
            rowKey={(row) => row.reservation_id}
            table={
            <div className="govern-table-wrap">
            <table className="govern-table">
              <thead>
                <tr>
                  {prefs.isVisible('state') && <SortTh label="State" sortKey="state" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                  {prefs.isVisible('resource') && <SortTh label="Resource" sortKey="resource_ref" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                  {prefs.isVisible('window') && <SortTh label="Window" sortKey="window_start" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                  {prefs.isVisible('project') && <th>Project</th>}
                  {prefs.isVisible('purpose') && <th>Purpose</th>}
                  {prefs.isVisible('actor') && <th>Requested by</th>}
                  {prefs.isVisible('created') && <SortTh label="Created" sortKey="created_at" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                  {prefs.isVisible('conflict') && <th>Conflict</th>}
                  {canManage && prefs.isVisible('actions') && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.reservation_id}>
                    {prefs.isVisible('state') && (
                      <td>
                        <span className={stateClass(row.state)}>{row.state}</span>
                      </td>
                    )}
                    {prefs.isVisible('resource') && <td className="govern-mono">{row.resource_ref}</td>}
                    {prefs.isVisible('window') && (
                      <td className="govern-muted" style={{ fontSize: 'var(--text-xs)' }}>
                        {formatWindow(row.window_start)} → {formatWindow(row.window_end)}
                      </td>
                    )}
                    {prefs.isVisible('project') && <td className="govern-mono">{row.project_id || '—'}</td>}
                    {prefs.isVisible('purpose') && <td>{row.purpose}</td>}
                    {prefs.isVisible('actor') && <td>{row.created_by || '—'}</td>}
                    {prefs.isVisible('created') && (
                      <td className="govern-muted">{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                    )}
                    {prefs.isVisible('conflict') && (
                      <td>
                        {row.has_conflict ? (
                          <span className="govern-status govern-status--warn">{row.conflict_ids?.length || 1} overlap</span>
                        ) : (
                          <span className="govern-muted">None</span>
                        )}
                      </td>
                    )}
                    {canManage && prefs.isVisible('actions') && (
                      <td>
                        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {row.state === 'requested' && (
                            <button type="button" className="qre-btn qre-btn--ghost" disabled={busy} onClick={() => transition(row.reservation_id, 'active')}>
                              Activate
                            </button>
                          )}
                          {row.state === 'active' && (
                            <button type="button" className="qre-btn qre-btn--ghost" disabled={busy} onClick={() => transition(row.reservation_id, 'released')}>
                              Release
                            </button>
                          )}
                          {(row.state === 'requested' || row.state === 'active') && (
                            <button
                              type="button"
                              className="qre-btn qre-btn--ghost"
                              onClick={() => setPending({ row, state: 'cancelled' })}
                            >
                              Cancel
                            </button>
                          )}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            }
          />
        )}
      </div>
      <ConfirmDialog
        title={pending ? 'Cancel this reservation?' : ''}
        body={pending ? 'Drops the hold. The asset stays in inventory; no provider job is affected.' : ''}
        confirmLabel="Cancel hold"
        danger
        onCancel={() => setPending(null)}
        onConfirm={() => pending && transition(pending.row.reservation_id, pending.state)}
      />
    </GovernPageShell>
  );
}
