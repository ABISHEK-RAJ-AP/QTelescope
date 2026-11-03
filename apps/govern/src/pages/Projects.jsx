import { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import { readContextProjectId, writeContextProjectId } from '@qre-theme/contextScope.js';
import { api } from '../api.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import ListViewToolbar from '../components/ListViewToolbar.jsx';
import AdaptiveListView from '../components/AdaptiveListView.jsx';
import { EmptyState, SortTh } from '../components/ui.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';
import { matchQuery, nextSort, sortBy } from '../lib/format.js';

const PROJECT_COLS = [
  {
    id: 'name',
    label: 'Name',
    gridWide: true,
    gridRender: (p) => (
      <>
        <strong>{p.name}</strong>
        <span className="govern-table__sub">{p.project_id}</span>
      </>
    ),
  },
  { id: 'type', label: 'Type', gridRender: (p) => p.project_type || p.template_id || '—' },
  { id: 'owner', label: 'Owner', gridRender: (p) => p.owner_username || p.owner || '—' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'updated', label: 'Updated', gridRender: (p) => (p.updated_at ? new Date(p.updated_at).toLocaleString() : '—') },
  { id: 'actions', label: 'Actions' },
];
import { approvalsListPath } from '../lib/approvalsQuery.js';

export default function Projects({ onOpen }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [contextProjectId, setContextProjectId] = useState(() => readContextProjectId());
  const [query, setQuery] = useState('');
  const [waitingByProject, setWaitingByProject] = useState({});
  const [sort, setSort] = useState({ key: 'updated_at', dir: 'desc' });
  const prefs = useTablePrefs('projects', PROJECT_COLS);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([api('/projects'), api(approvalsListPath({})).catch(() => ({ items: [] }))])
      .then(([data, queue]) => {
        setRows(Array.isArray(data) ? data : []);
        const counts = {};
        (queue.items || []).forEach((item) => {
          if (!item.project_id) return;
          counts[item.project_id] = (counts[item.project_id] || 0) + 1;
        });
        setWaitingByProject(counts);
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const syncCtx = () => setContextProjectId(readContextProjectId());
    window.addEventListener('qre-context-changed', syncCtx);
    return () => window.removeEventListener('qre-context-changed', syncCtx);
  }, [load]);

  const listColumns = useMemo(
    () =>
      PROJECT_COLS.map((c) =>
        c.id === 'waiting' ? { ...c, gridRender: (p) => waitingByProject[p.project_id] || 0 } : c,
      ),
    [waitingByProject],
  );

  const visible = useMemo(() => {
    const rowsFiltered = rows.filter((p) => matchQuery(query, p.name, p.owner_username, p.owner, p.project_id, p.project_type));
    return sortBy(rowsFiltered, sort.key, sort.dir, (p) => {
      if (sort.key === 'waiting') return waitingByProject[p.project_id] || 0;
      if (sort.key === 'updated_at') return p.updated_at ? new Date(p.updated_at).getTime() : 0;
      return p[sort.key];
    });
  }, [rows, query, sort, waitingByProject]);

  function setGovernContext(projectId) {
    writeContextProjectId(projectId);
    setContextProjectId(projectId);
  }

  return (
    <GovernPageShell
      eyebrow="Governance"
      title="Organizations & projects"
      subtitle="Tenant projects for governance context. Pin a project to filter approvals, My work, and audit activity."
      loading={loading && rows.length === 0}
      error={error}
      onRetry={load}
      onOpen={onOpen}
      loadingLabel="Loading projects…"
    >
      <div className="qre-card">
        {rows.length > 0 ? (
          <div className="page-filters">
            <input
              className="govern-search"
              type="search"
              placeholder="Name, owner, id…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Find project"
            />
            <ListViewToolbar prefs={prefs} columns={PROJECT_COLS} lockedIds={['name']} />
          </div>
        ) : null}
        {rows.length === 0 ? (
          <EmptyState
            title="No projects in this tenant"
            hint="Projects are created via the platform registry API; they appear here when registered for this tenant."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No projects match this search"
            hint="Clear the search to see every tenant project."
            action={
              <button type="button" className="qre-btn qre-btn--ghost" onClick={() => setQuery('')}>
                Clear search
              </button>
            }
          />
        ) : (
          <AdaptiveListView
            prefs={prefs}
            items={visible}
            rowKey={(p) => p.project_id}
            onRowClick={(p) => onOpen?.(`#/projects/${p.project_id}`)}
            columns={listColumns}
            table={
          <div className="govern-table-wrap">
            <table className="govern-table">
              <thead>
                <tr>
                  {prefs.isVisible('name') && <SortTh label="Name" sortKey="name" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                  {prefs.isVisible('type') && <SortTh label="Type" sortKey="project_type" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                  {prefs.isVisible('owner') && <SortTh label="Owner" sortKey="owner_username" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                  {prefs.isVisible('waiting') && <SortTh label="Waiting" sortKey="waiting" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                  {prefs.isVisible('updated') && <SortTh label="Updated" sortKey="updated_at" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                  {prefs.isVisible('actions') && <th />}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const isContext = contextProjectId === p.project_id;
                  return (
                    <tr
                      key={p.project_id}
                      className="govern-table__row--click"
                      onClick={() => onOpen?.(`#/projects/${p.project_id}`)}
                    >
                      {prefs.isVisible('name') && (
                      <td>
                        <button
                          type="button"
                          className="govern-table__primary"
                          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }}
                          onClick={() => onOpen?.(`#/projects/${p.project_id}`)}
                        >
                          <strong>{p.name}</strong>
                        </button>
                        <span className="govern-table__sub">{p.project_id}</span>
                      </td>
                      )}
                      {prefs.isVisible('type') && <td>{p.project_type || p.template_id || '—'}</td>}
                      {prefs.isVisible('owner') && <td>{p.owner_username || p.owner || '—'}</td>}
                      {prefs.isVisible('waiting') && <td>{waitingByProject[p.project_id] || 0}</td>}
                      {prefs.isVisible('updated') && <td className="govern-muted">{p.updated_at ? new Date(p.updated_at).toLocaleString() : '—'}</td>}
                      {prefs.isVisible('actions') && (
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className={`qre-btn qre-btn--ghost${isContext ? ' qre-btn--primary' : ''}`}
                            style={{ padding: '4px 10px', fontSize: 'var(--text-xs)' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setGovernContext(isContext ? '' : p.project_id);
                            }}
                            title="Filter approvals by this project"
                          >
                            <Filter size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            {isContext ? 'Context on' : 'Set context'}
                          </button>
                          <button
                            type="button"
                            className="qre-btn qre-btn--ghost"
                            style={{ padding: '4px 10px', fontSize: 'var(--text-xs)' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpen?.(`#/projects/${p.project_id}`);
                            }}
                          >
                            Details
                          </button>
                        </div>
                      </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
            }
          />
        )}
      </div>
    </GovernPageShell>
  );
}
