import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { api, apiBase, authHeaders } from '../api.js';
import { labelDecision } from '../labels.js';
import { useContextProjectId } from '../hooks/useContextProject.js';
import { governanceActivityPath } from '../lib/approvalsQuery.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import ListViewToolbar from '../components/ListViewToolbar.jsx';
import AdaptiveListView from '../components/AdaptiveListView.jsx';
import { EmptyState, ListCap, SortTh } from '../components/ui.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';
import { matchQuery, nextSort, relativeTime, sortBy } from '../lib/format.js';

const AUDIT_COLS = [
  { id: 'time', label: 'Time' },
  { id: 'actor', label: 'Actor' },
  { id: 'action', label: 'Action' },
  { id: 'target', label: 'Target' },
  { id: 'project', label: 'Project' },
];

function formatAction(action) {
  if (action?.startsWith('approval.')) return labelDecision(action.replace('approval.', ''));
  return action?.replaceAll('.', ' · ') || 'Event';
}

export default function Audit({ permissions, onOpen }) {
  const [tab, setTab] = useState('governance');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState({ key: 'timestamp', dir: 'desc' });
  const [notice, setNotice] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const canPlatform = permissions.includes('audit:read') || permissions.includes('platform:manage');
  const canExport = permissions.includes('audit:export') || permissions.includes('platform:manage');
  const contextProjectId = useContextProjectId();
  const showProjectCol = tab === 'governance' && !contextProjectId;
  const prefs = useTablePrefs('audit', AUDIT_COLS);

  function load() {
    setLoading(true);
    setError('');
    const path =
      tab === 'platform' && canPlatform
        ? '/governance/audit-events?action_prefix=governance.&limit=200'
        : governanceActivityPath(contextProjectId);
    api(path)
      .then((body) => setItems(body.items || []))
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [tab, canPlatform, contextProjectId]);

  useEffect(() => {
    const onCtx = () => {
      if (tab === 'governance') load();
    };
    window.addEventListener('qre-context-changed', onCtx);
    return () => window.removeEventListener('qre-context-changed', onCtx);
  }, [tab, contextProjectId]);

  const visible = useMemo(() => {
    const rows = items
      .filter((row) => matchQuery(query, row.actor, row.action, row.target_id, row.target_type, formatAction(row.action)))
      .filter((row) => {
        if (!from && !to) return true;
        const ts = row.timestamp ? new Date(row.timestamp).getTime() : 0;
        if (from && ts < new Date(`${from}T00:00:00`).getTime()) return false;
        if (to && ts > new Date(`${to}T23:59:59`).getTime()) return false;
        return true;
      });
    return sortBy(rows, sort.key, sort.dir, (row) => {
      if (sort.key === 'timestamp') return row.timestamp ? new Date(row.timestamp).getTime() : 0;
      if (sort.key === 'action') return formatAction(row.action);
      return row[sort.key];
    });
  }, [items, query, from, to, sort]);

  async function exportCsv() {
    const path =
      tab === 'platform' && canPlatform
        ? '/governance/audit-events/export?action_prefix=governance.&limit=2000'
        : `/governance/activity/export${contextProjectId ? `?project_id=${encodeURIComponent(contextProjectId)}` : ''}`;
    setExportBusy(true);
    setNotice('');
    try {
      const response = await fetch(`${apiBase()}${path}`, { headers: authHeaders() });
      const text = await response.text();
      if (!response.ok) throw new Error(text || response.statusText);
      const blob = new Blob([text], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = tab === 'platform' ? 'platform-audit.csv' : 'governance-activity.csv';
      link.click();
      URL.revokeObjectURL(link.href);
      setNotice('Export downloaded.');
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <GovernPageShell
      eyebrow="Operations"
      title="Audit & evidence"
      subtitle={
        contextProjectId
          ? 'Governance decisions for workloads in the header project filter.'
          : 'Decision trail from approval records. Platform tab lists server events when your role includes audit:read.'
      }
      loading={loading && items.length === 0}
      error={error}
      notice={notice}
      onRetry={load}
      onOpen={onOpen}
      loadingLabel="Loading audit trail…"
      actions={
        canExport ? (
          <button type="button" className="qre-btn qre-btn--ghost" onClick={exportCsv} disabled={exportBusy}>
            <Download size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            {exportBusy ? 'Exporting…' : 'Export CSV'}
          </button>
        ) : null
      }
    >
      <div className="qre-card">
        <div className="page-filters govern-toolbar">
          <div className="qre-tabs page-filters__grow" role="tablist" aria-label="Audit views" style={{ marginBottom: 0, borderBottom: 'none' }}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'governance'}
              className={`qre-tab${tab === 'governance' ? ' qre-tab--active' : ''}`}
              onClick={() => setTab('governance')}
            >
              Governance decisions
            </button>
            {canPlatform && (
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'platform'}
                className={`qre-tab${tab === 'platform' ? ' qre-tab--active' : ''}`}
                onClick={() => setTab('platform')}
              >
                Platform audit log
              </button>
            )}
          </div>
          <input
            className="govern-search"
            type="search"
            placeholder="Actor, action, target…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Find event"
          />
          <label className="qre-field">
            <span className="qre-field__label">From</span>
            <input className="qre-field__input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="qre-field">
            <span className="qre-field__label">To</span>
            <input className="qre-field__input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <ListViewToolbar prefs={prefs} columns={AUDIT_COLS} lockedIds={['time', 'action']} />
        </div>
        {!loading && items.length === 0 && (
          <EmptyState
            title="No events yet"
            hint="Decisions appear after reviewers act on the queue. Export stays empty until the first recorded action."
            action={
              <button type="button" className="qre-btn qre-btn--primary" onClick={() => onOpen?.('#/queue')}>
                Open approval queue
              </button>
            }
          />
        )}
        {!loading && items.length > 0 && visible.length === 0 && (
          <EmptyState
            title="No events in this filter"
            hint="Clear search or the date range to see the full trail."
            action={
              <button
                type="button"
                className="qre-btn qre-btn--ghost"
                onClick={() => {
                  setQuery('');
                  setFrom('');
                  setTo('');
                }}
              >
                Clear filters
              </button>
            }
          />
        )}
        {!loading && visible.length > 0 && (
          <AdaptiveListView
            prefs={prefs}
            items={visible}
            columns={AUDIT_COLS}
            rowKey={(row) => row.id}
            onRowClick={(row) => {
              if (!row.target_id) return;
              if (row.target_type === 'workload' || String(row.action || '').startsWith('approval.')) {
                onOpen?.(`#/queue/${row.target_id}`);
              }
            }}
            table={
          <div className="govern-table-wrap">
            <table className="govern-table">
              <thead>
                <tr>
                  {prefs.isVisible('time') && <SortTh label="Time" sortKey="timestamp" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                  {prefs.isVisible('actor') && <SortTh label="Actor" sortKey="actor" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                  {prefs.isVisible('action') && <SortTh label="Action" sortKey="action" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                  {prefs.isVisible('target') && <SortTh label="Target" sortKey="target_id" sort={sort} onSort={(key) => setSort((s) => nextSort(s, key))} />}
                  {showProjectCol && prefs.isVisible('project') && <th>Project</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className={row.target_id ? 'govern-table__row--click' : undefined}
                    onClick={() => {
                      if (!row.target_id) return;
                      if (row.target_type === 'workload' || String(row.action || '').startsWith('approval.')) {
                        onOpen?.(`#/queue/${row.target_id}`);
                      }
                    }}
                  >
                    {prefs.isVisible('time') && (
                    <td className="govern-muted" title={row.timestamp ? new Date(row.timestamp).toLocaleString() : ''}>
                      {relativeTime(row.timestamp) || (row.timestamp ? new Date(row.timestamp).toLocaleString() : '—')}
                    </td>
                    )}
                    {prefs.isVisible('actor') && <td>{row.actor}</td>}
                    {prefs.isVisible('action') && <td>{formatAction(row.action)}</td>}
                    {prefs.isVisible('target') && (
                    <td>
                      <span className="govern-table__sub">{row.target_type}</span>
                      {row.target_id}
                    </td>
                    )}
                    {showProjectCol && prefs.isVisible('project') && (
                      <td className="govern-muted govern-mono" style={{ fontSize: 'var(--text-xs)' }}>
                        {row.detail?.project_id ? row.detail.project_id.slice(0, 8) + '…' : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <ListCap count={items.length} cap={200} noun="events" />
          </div>
            }
            footer={null}
          />
        )}
      </div>
    </GovernPageShell>
  );
}
