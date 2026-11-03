import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useContextProjectId } from '../hooks/useContextProject.js';
import { approvalsListPath } from '../lib/approvalsQuery.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import ListViewToolbar from '../components/ListViewToolbar.jsx';
import AdaptiveListView from '../components/AdaptiveListView.jsx';
import { EmptyState, KpiStrip, StatusBadge, WorkloadLink } from '../components/ui.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';
import { labelState } from '../labels.js';
import { matchQuery } from '../lib/format.js';
import { approvalGridFields } from '../lib/approvalListGrid.jsx';

const MY_WORK_COLS = [
  { id: 'status', label: 'Status' },
  { id: 'workload', label: 'Workload' },
  { id: 'requester', label: 'Requester', defaultHidden: true },
  { id: 'stage', label: 'Stage' },
  { id: 'actions', label: 'Actions' },
];

const TABS = [
  { id: '', label: 'All' },
  { id: 'submitted_for_review', label: 'Awaiting review' },
  { id: 'in_review', label: 'In review' },
  { id: 'changes_requested', label: 'Changes requested' },
  { id: 'approved', label: 'Approved' },
];

export default function MyWork({ onOpen }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const contextProjectId = useContextProjectId();
  const prefs = useTablePrefs('my-work', MY_WORK_COLS);
  const gridFields = useMemo(() => approvalGridFields(onOpen, { actionLabel: 'Open' }), [onOpen]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api(approvalsListPath({ scope: 'mine', projectId: contextProjectId || undefined }))
      .then((body) => setItems(body.items || []))
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }, [contextProjectId]);

  useEffect(() => {
    load();
    window.addEventListener('qre-role-changed', load);
    window.addEventListener('qre-context-changed', load);
    return () => {
      window.removeEventListener('qre-role-changed', load);
      window.removeEventListener('qre-context-changed', load);
    };
  }, [load]);

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (filter && item.governance_state !== filter) return false;
      return matchQuery(query, item.workload_id, item.created_by, item.governance_state);
    });
  }, [items, filter, query]);

  return (
    <GovernPageShell
      title="My work"
      subtitle={
        contextProjectId
          ? 'Your submissions and stage assignments in the selected project.'
          : 'Submissions you created and approvals your role can act on in the current policy stage.'
      }
      loading={loading && items.length === 0}
      error={error}
      onRetry={load}
      onOpen={onOpen}
      loadingLabel="Loading your work queue…"
    >
      {items.length > 0 ? (
        <KpiStrip
          items={['submitted_for_review', 'in_review', 'changes_requested', 'approved'].map((state) => ({
            key: state,
            label: labelState(state),
            value: items.filter((item) => item.governance_state === state).length,
            hint: 'Filter',
            onClick: () => setFilter(state),
          }))}
        />
      ) : null}
      <div className="qre-card">
        {items.length === 0 ? (
          <EmptyState
            title={contextProjectId ? 'No items for this project' : 'Nothing assigned to you right now'}
            hint={
              contextProjectId
                ? 'Clear Project in the page header, or open the shared approval queue.'
                : 'Submissions you created or approvals your role can decide appear here.'
            }
            action={
              <button type="button" className="qre-btn qre-btn--primary" onClick={() => onOpen('#/queue')}>
                Open approval queue
              </button>
            }
          />
        ) : (
          <>
            <div className="page-filters govern-toolbar">
              <div className="qre-tabs page-filters__grow" style={{ marginBottom: 0, borderBottom: 'none' }}>
                {TABS.map((tab) => (
                  <button
                    key={tab.id || 'all'}
                    type="button"
                    className={`qre-tab${filter === tab.id ? ' qre-tab--active' : ''}`}
                    onClick={() => setFilter(tab.id)}
                  >
                    {tab.label}
                    {tab.id === '' ? ` (${items.length})` : ''}
                  </button>
                ))}
              </div>
              <input
                className="govern-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search workload or requester…"
                aria-label="Search my work"
              />
              <ListViewToolbar prefs={prefs} columns={MY_WORK_COLS} lockedIds={['status', 'workload']} />
            </div>
            {visible.length === 0 ? (
              <EmptyState
                title={query.trim() ? 'No matching assignments' : 'Nothing in this view'}
                hint={query.trim() ? 'Clear the search, or try another tab.' : 'Try All, or clear the search.'}
                action={
                  query || filter ? (
                    <button
                      type="button"
                      className="qre-btn qre-btn--ghost"
                      onClick={() => {
                        setFilter('');
                        setQuery('');
                      }}
                    >
                      Show all
                    </button>
                  ) : null
                }
              />
            ) : (
              <AdaptiveListView
                prefs={prefs}
                items={visible}
                rowKey={(item) => item.submission_id}
                onRowClick={(item) => onOpen(`#/queue/${item.workload_id}`)}
                gridFields={gridFields}
                table={
              <div className="govern-table-wrap">
                <table className="govern-table">
                  <thead>
                    <tr>
                      {prefs.isVisible('status') && <th>Status</th>}
                      {prefs.isVisible('workload') && <th>Workload</th>}
                      {prefs.isVisible('requester') && <th>Requester</th>}
                      {prefs.isVisible('stage') && <th>Stage</th>}
                      {prefs.isVisible('actions') && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item) => (
                      <tr
                        key={item.submission_id}
                        className="govern-table__row--click"
                        onClick={() => onOpen(`#/queue/${item.workload_id}`)}
                      >
                        {prefs.isVisible('status') && (
                          <td>
                            <StatusBadge state={item.governance_state} />
                          </td>
                        )}
                        {prefs.isVisible('workload') && (
                          <td>
                            <WorkloadLink workloadId={item.workload_id} onOpen={onOpen} />
                            <span className="govern-table__sub">{item.created_by}</span>
                          </td>
                        )}
                        {prefs.isVisible('requester') && <td>{item.created_by || '—'}</td>}
                        {prefs.isVisible('stage') && <td>{item.governance_progress?.current_stage?.label || 'Review'}</td>}
                        {prefs.isVisible('actions') && (
                        <td>
                          <button
                            type="button"
                            className="qre-btn qre-btn--primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpen(`#/queue/${item.workload_id}`);
                            }}
                          >
                            Open
                          </button>
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
          </>
        )}
      </div>
    </GovernPageShell>
  );
}
