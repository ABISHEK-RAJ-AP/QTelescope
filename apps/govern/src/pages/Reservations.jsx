import { useEffect, useMemo, useState } from 'react';
import { useContextProjectId } from '../hooks/useContextProject.js';
import { api } from '../api.js';
import { reservationsListPath } from '../lib/approvalsQuery.js';
import { projectIdFromHash } from '../lib/hashProject.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import { buildQrpBreadcrumbs } from '../nav/qrpNav.js';
import LifecycleStrip from '../components/LifecycleStrip.jsx';
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function stateClass(state) {
  if (state === 'active') return 'govern-status govern-status--ok';
  if (state === 'cancelled') return 'govern-status govern-status--bad';
  if (state === 'released') return 'govern-status';
  return 'govern-status govern-status--warn';
}

function defaultWindow(fromDay) {
  const start = fromDay ? new Date(fromDay) : new Date();
  if (!fromDay) {
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
  } else {
    start.setHours(15, 0, 0, 0);
  }
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    window_start: toLocalInput(start.toISOString()),
    window_end: toLocalInput(end.toISOString()),
  };
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function Reservations({ onOpen, permissions = [], initialState = '' }) {
  const contextProjectId = useContextProjectId();
  const hashProjectId = typeof window !== 'undefined' ? projectIdFromHash(window.location.hash) : '';
  const scopeProjectId = contextProjectId || hashProjectId;
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [noticeOk, setNoticeOk] = useState(undefined);
  const [filter, setFilter] = useState(initialState);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('calendar');
  const [sort, setSort] = useState({ key: 'window_start', dir: 'asc' });
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(() => ymd(new Date()));
  const [schedulingPolicy, setSchedulingPolicy] = useState(null);
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
      api(reservationsListPath({ projectId: scopeProjectId || undefined })),
      api('/inventory/assets').catch(() => ({ items: [] })),
      api('/projects').catch(() => []),
      api('/governance/scheduling-config').catch(() => null),
    ])
      .then(([body, inventory, projectRows, policy]) => {
        setItems(body.items || []);
        setAssets(inventory.items || []);
        setProjects(Array.isArray(projectRows) ? projectRows : projectRows.items || []);
        setSchedulingPolicy(policy);
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [scopeProjectId]);

  useEffect(() => {
    setFilter(initialState || '');
  }, [initialState]);

  function pickDay(day) {
    if (!day) return;
    const key = ymd(day);
    setSelectedDay(key);
    setForm((f) => ({ ...f, ...defaultWindow(day) }));
  }

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
      setNoticeOk(!row.has_conflict);
      setNotice(row.has_conflict ? 'Hold requested. Overlaps an existing hold on this resource — review before activating.' : 'Hold requested.');
      setForm({ resource_ref: '', project_id: '', purpose: '', ...defaultWindow() });
      await load();
    } catch (e) {
      setNoticeOk(false);
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  function transitionErrorMessage(err, state) {
    const msg = String(err.message || err);
    if (/conflict|overlap/i.test(msg)) {
      return `Transition to “${state}” blocked: ${msg}`;
    }
    if (/invalid|transition|state/i.test(msg)) {
      return `Cannot move hold to “${state}”: ${msg}`;
    }
    return msg;
  }

  async function transition(id, state) {
    setNotice('');
    setBusy(true);
    try {
      await api(`/reservations/${encodeURIComponent(id)}/transition`, {
        method: 'POST',
        body: JSON.stringify({ state }),
      });
      setNoticeOk(true);
      setNotice(`Hold ${state}.`);
      setPending(null);
      await load();
    } catch (e) {
      setNoticeOk(false);
      setNotice(transitionErrorMessage(e, state));
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

  const holdsByDay = useMemo(() => {
    const map = new Map();
    visible.forEach((row) => {
      const d = new Date(row.window_start);
      if (Number.isNaN(d.getTime())) return;
      const key = ymd(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }, [visible]);

  const dayHolds = holdsByDay.get(selectedDay) || [];
  const cells = monthMatrix(cursor.year, cursor.month);
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const conflictCount = items.filter((row) => row.has_conflict).length;

  function shiftMonth(delta) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <GovernPageShell
      breadcrumbs={buildQrpBreadcrumbs('resource-ops', 'Holds & reservations')}
      title="Holds & reservations"
      subtitle={
        scopeProjectId
          ? `Holds for project ${scopeProjectId.slice(0, 8)}… · ${tz}. Calendar = existing holds, not provider availability.`
          : `Governance hold windows · ${tz}. Calendar = existing holds, not provider availability.`
      }
      loading={loading && items.length === 0}
      error={error}
      notice={notice}
      noticeOk={noticeOk}
      onRetry={load}
      onOpen={onOpen}
      loadingLabel="Loading holds…"
    >
      <LifecycleStrip current="hold" onOpen={onOpen} permissions={permissions} />

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

      <div className="govern-hold-layout">
        {canManage ? (
          <form className="qre-card dashboard-card govern-stack govern-hold-layout__form" onSubmit={createReservation}>
            <div className="govern-section-head">
              <h3 className="dashboard-card-title">Request hold</h3>
              <span className="govern-muted">Hold ≠ booking · Hold ≠ dispatch</span>
            </div>
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
                    placeholder="Asset or backend ref"
                  />
                )}
              </label>
              <label className="qre-field">
                <span className="qre-field__label">Project</span>
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
                <span className="qre-field__label">Window start (local)</span>
                <input
                  className="qre-field__input"
                  type="datetime-local"
                  required
                  value={form.window_start}
                  onChange={(e) => setForm({ ...form, window_start: e.target.value })}
                />
              </label>
              <label className="qre-field">
                <span className="qre-field__label">Window end (local)</span>
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
                placeholder="Request window"
              />
            </label>
            <button type="submit" className="qre-btn qre-btn--primary" disabled={busy}>
              {busy ? 'Saving…' : 'New hold'}
            </button>
          </form>
        ) : (
          <div className="qre-card govern-stack">
            <EmptyState title="View-only" hint="You can inspect holds. Requesting a window needs reservations:manage." />
          </div>
        )}

        <div className="qre-card dashboard-card govern-hold-layout__cal">
          <div className="govern-section-head">
            <h3 className="dashboard-card-title">Hold calendar</h3>
            <div className="govern-cal-nav">
              <button type="button" className="qre-btn qre-btn--ghost" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                ‹
              </button>
              <strong>{monthLabel}</strong>
              <button type="button" className="qre-btn qre-btn--ghost" onClick={() => shiftMonth(1)} aria-label="Next month">
                ›
              </button>
              <button
                type="button"
                className="qre-btn qre-btn--ghost qre-btn--sm"
                onClick={() => {
                  const today = new Date();
                  setCursor({ year: today.getFullYear(), month: today.getMonth() });
                  pickDay(today);
                }}
              >
                Today
              </button>
            </div>
          </div>
          <p className="govern-muted" style={{ margin: '0 0 8px', fontSize: 'var(--text-xs)' }}>
            {schedulingPolicy?.configured ? (
              <>
                Scheduling policy on file ({schedulingPolicy.timezone || 'timezone'}).{' '}
                <button type="button" className="fs-link" onClick={() => onOpen?.('#/schedule/admin')}>
                  View policy
                </button>
                . Holds still overlap-check only — policy is not enforced on create yet.
              </>
            ) : (
              <>
                No scheduling policy published. Holds overlap-check only against other holds.{' '}
                <button type="button" className="fs-link" onClick={() => onOpen?.('#/schedule/admin')}>
                  Scheduling admin
                </button>
              </>
            )}
          </p>
          <div className="govern-month" role="grid" aria-label="Hold calendar">
            <div className="govern-month__head">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="govern-month__grid">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} className="govern-month__cell is-empty" />;
                const key = ymd(day);
                const rows = holdsByDay.get(key) || [];
                const selected = key === selectedDay;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`govern-month__cell${selected ? ' is-selected' : ''}${rows.length ? ' has-holds' : ''}`}
                    onClick={() => pickDay(day)}
                  >
                    <span className="govern-month__num">{day.getDate()}</span>
                    {rows.length ? <span className="govern-month__badge">{rows.length}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="govern-day-panel">
            <h4 className="govern-section-title">
              {selectedDay} · {dayHolds.length} hold{dayHolds.length === 1 ? '' : 's'}
            </h4>
            {dayHolds.length === 0 ? (
              <p className="govern-muted" style={{ margin: 0 }}>
                No holds this day. Pick a day, fill the form, request a window.
              </p>
            ) : (
              <ul className="govern-cal__list">
                {dayHolds.map((row) => (
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
            )}
          </div>
        </div>
      </div>

      <div className="qre-card dashboard-card">
        <div className="page-filters govern-toolbar page-toolbar-unified">
          <div className="qre-tabs page-filters__grow" role="tablist" aria-label="Reservation state">
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
          <div className="qre-tabs" role="tablist" aria-label="List view">
            <button type="button" className={`qre-tab${view === 'calendar' ? ' qre-tab--active' : ''}`} onClick={() => setView('calendar')}>
              Day focus
            </button>
            <button type="button" className={`qre-tab${view === 'list' ? ' qre-tab--active' : ''}`} onClick={() => setView('list')}>
              Table
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
          {view === 'list' ? <ListViewToolbar prefs={prefs} columns={COLS} lockedIds={['state', 'resource']} /> : null}
        </div>

        {view === 'calendar' ? (
          dayHolds.length === 0 && visible.length === 0 ? (
            <EmptyState
              title={items.length ? 'No holds in this filter' : 'No reservations'}
              hint={items.length ? 'Clear the tab, or request a new window in the form.' : 'Create a hold when a project needs exclusive access.'}
              action={
                filter ? (
                  <button type="button" className="qre-btn qre-btn--ghost" onClick={() => setFilter('')}>
                    Show all holds
                  </button>
                ) : (
                  <button type="button" className="qre-btn qre-btn--primary" onClick={() => onOpen?.('#/inventory')}>
                    Open inventory
                  </button>
                )
              }
            />
          ) : (
            <p className="govern-muted" style={{ margin: 0 }}>
              Day detail is in the calendar panel above. Switch to Table for bulk actions.
            </p>
          )
        ) : visible.length === 0 ? (
          <EmptyState title="No holds in this filter" hint="Clear filters or request a hold." />
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
                                <button type="button" className="qre-btn qre-btn--ghost" onClick={() => setPending({ row, state: 'cancelled' })}>
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
        title={pending ? 'Cancel this hold?' : ''}
        body={pending ? 'Drops the hold. Asset stays in inventory; no provider job is affected.' : ''}
        confirmLabel="Cancel hold"
        danger
        onCancel={() => setPending(null)}
        onConfirm={() => pending && transition(pending.row.reservation_id, pending.state)}
      />
    </GovernPageShell>
  );
}
