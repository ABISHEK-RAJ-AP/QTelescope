import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { labelState } from '../labels.js';
import { useContextProjectId } from '../hooks/useContextProject.js';
import { approvalsListPath, governanceSummaryPath } from '../lib/approvalsQuery.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import AdaptiveListView from '../components/AdaptiveListView.jsx';
import ListViewToolbar from '../components/ListViewToolbar.jsx';
import { EmptyState, KpiStrip, ListCap, SortTh, StatusBadge, WorkloadLink } from '../components/ui.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';
import { approvalGridFields } from '../lib/approvalListGrid.jsx';
import { nextSort, sortBy } from '../lib/format.js';
import { writeQueueIds } from '../lib/queueNav.js';

const QUEUE_COLS = [
  { id: 'status', label: 'Status' },
  { id: 'workload', label: 'Workload' },
  { id: 'requester', label: 'Requester', defaultHidden: true },
  { id: 'stage', label: 'Stage' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'actions', label: 'Actions' },
];

function waitLabel(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '—';
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}m`;
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function Queue({ onOpen, initialState }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialState || '');
  const [query, setQuery] = useState('');
  const [counts, setCounts] = useState(null);
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const contextProjectId = useContextProjectId();
  const prefs = useTablePrefs('queue', QUEUE_COLS);
  const gridFields = useMemo(
    () => approvalGridFields(onOpen, { showWaiting: true, showSubmitted: true }),
    [onOpen],
  );

  function applyFilter(next) {
    const hash = next ? `#/queue?state=${encodeURIComponent(next)}` : '#/queue';
    if ((window.location.hash || '#/') !== hash) window.location.hash = hash;
    else setFilter(next);
  }

  useEffect(() => {
    setFilter(initialState || '');
  }, [initialState]);

  function load() {
    setLoading(true);
    setError('');
    Promise.all([
      api(approvalsListPath({ state: filter || undefined, projectId: contextProjectId || undefined })),
      api(governanceSummaryPath(contextProjectId)).catch(() => null),
    ])
      .then(([body, summary]) => {
        setItems(body.items || []);
        if (summary?.counts) setCounts(summary.counts);
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [filter, contextProjectId]);

  useEffect(() => {
    window.addEventListener('qre-role-changed', load);
    window.addEventListener('qre-context-changed', load);
    return () => {
      window.removeEventListener('qre-role-changed', load);
      window.removeEventListener('qre-context-changed', load);
    };
  }, [filter, contextProjectId]);

  const visible = useMemo(() => {
    let rows = filter ? items.filter((item) => item.governance_state === filter) : items;
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (item) =>
          item.workload_id?.toLowerCase().includes(q)
          || item.created_by?.toLowerCase().includes(q),
      );
    }
    return sortBy(rows, sort.key, sort.dir, (row) => {
      if (sort.key === 'waiting') return row.created_at ? new Date(row.created_at).getTime() : 0;
      if (sort.key === 'stage') return row.governance_progress?.current_stage?.label || '';
      return row[sort.key];
    });
  }, [items, filter, query, sort]);

  useEffect(() => {
    writeQueueIds(visible.map((item) => item.workload_id));
  }, [visible]);

  const tabs = [
    { id: '', label: 'All waiting' },
    { id: 'submitted_for_review', label: 'Awaiting review' },
    { id: 'in_review', label: 'In review' },
    { id: 'changes_requested', label: 'Changes requested' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ];

  return (
    <GovernPageShell
      eyebrow="Admission"
      title="Approval queue"
      subtitle={
        contextProjectId
          ? 'Filtered to the selected project. Clear Project to see the full tenant queue.'
          : 'Open a workload to inspect package hash, policy version, stage progress, and decision history.'
      }
      loading={loading && items.length === 0}
      error={error}
      onRetry={load}
      onOpen={onOpen}
      loadingLabel="Loading approval queue…"
    >
      {counts ? (
        <KpiStrip
          items={['submitted_for_review', 'in_review', 'changes_requested', 'approved'].map((state) => ({
            key: state,
            label: labelState(state),
            value: counts[state] ?? 0,
            hint: 'Filter',
            onClick: () => applyFilter(state),
          }))}
        />
      ) : null}
      <div className="qre-card">
        <div className="page-filters govern-toolbar">
          <div className="qre-tabs page-filters__grow" style={{ marginBottom: 0, borderBottom: 'none' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id || 'all'}
                type="button"
                className={`qre-tab${filter === tab.id ? ' qre-tab--active' : ''}`}
                onClick={() => applyFilter(tab.id)}
              >
                {tab.label}
                {tab.id === '' && ` (${items.length})`}
                {tab.id && counts?.[tab.id] != null ? ` (${counts[tab.id]})` : ''}
              </button>
            ))}
          </div>
          <input
            className="govern-search"
            type="search"
            placeholder="Search workload or requester…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search queue"
          />
          <ListViewToolbar prefs={prefs} columns={QUEUE_COLS} lockedIds={['status', 'workload']} />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={query.trim() ? 'No matching workloads' : 'Nothing in this view'}
            hint={
              query.trim()
                ? 'Clear the search, or try another state tab.'
                : 'Submissions appear after a workload is sent for institutional review. Try All waiting, or clear the project filter.'
            }
            action={
              filter || query ? (
                <button type="button" className="qre-btn qre-btn--ghost" onClick={() => { applyFilter(''); setQuery(''); }}>
                  Show all waiting
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
            footer={<ListCap count={items.length} cap={100} noun="approvals" />}
            table={
              <div className="govern-table-wrap">
                <table className="govern-table">
                  <thead>
                    <tr>
                      {prefs.isVisible('status') && <SortTh label="Status" sortKey="governance_state" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                      {prefs.isVisible('workload') && <SortTh label="Workload" sortKey="workload_id" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                      {prefs.isVisible('requester') && <SortTh label="Requester" sortKey="created_by" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                      {prefs.isVisible('stage') && <SortTh label="Stage" sortKey="stage" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                      {prefs.isVisible('waiting') && <SortTh label="Waiting" sortKey="waiting" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                      {prefs.isVisible('submitted') && <SortTh label="Submitted" sortKey="created_at" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                      {prefs.isVisible('actions') && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item) => {
                      const stage = item.governance_progress?.current_stage?.label || 'Review';
                      const index = (item.governance_progress?.stage_index ?? 0) + 1;
                      const total = item.governance_progress?.stage_total || 1;
                      return (
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
                          {prefs.isVisible('stage') && (
                            <td>
                              {stage}
                              <span className="govern-table__sub">
                                Stage {index} of {total}
                              </span>
                            </td>
                          )}
                          {prefs.isVisible('waiting') && <td className="govern-muted">{waitLabel(item.created_at)}</td>}
                          {prefs.isVisible('submitted') && (
                            <td className="govern-muted">
                              {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                            </td>
                          )}
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
                              Review
                            </button>
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
