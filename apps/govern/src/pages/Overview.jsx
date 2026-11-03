import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { api } from '../api.js';
import { labelState } from '../labels.js';
import { useContextProjectId } from '../hooks/useContextProject.js';
import { approvalsListPath, governanceActivityPath, governanceSummaryPath } from '../lib/approvalsQuery.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import { DonutMix, mixFromCounts } from '../components/GovernCharts.jsx';
import ListViewToolbar from '../components/ListViewToolbar.jsx';
import AdaptiveListView from '../components/AdaptiveListView.jsx';
import { EmptyState, KpiStrip, QuotaMeter, StatusBadge, WorkloadLink } from '../components/ui.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';
import { relativeTime } from '../lib/format.js';
import { approvalGridFields } from '../lib/approvalListGrid.jsx';

const OVERVIEW_COLS = [
  { id: 'status', label: 'Status' },
  { id: 'workload', label: 'Workload' },
  { id: 'stage', label: 'Stage' },
  { id: 'actions', label: 'Actions' },
];

const KPI = [
  { key: 'submitted_for_review', state: 'submitted_for_review', tone: '' },
  { key: 'in_review', state: 'in_review', tone: 'govern-kpi--tone-warn' },
  { key: 'changes_requested', state: 'changes_requested', tone: 'govern-kpi--tone-warn' },
  { key: 'approved', state: 'approved', tone: 'govern-kpi--tone-ok' },
];

function roleView(role) {
  const r = (role || '').toLowerCase();
  if (r.includes('research')) return 'researcher';
  if (r.includes('ops') || r === 'operator' || r.includes('incident')) return 'operator';
  return 'admin';
}

export default function Overview({ onOpen, role = 'Admin', permissions = [] }) {
  const view = roleView(role);
  const canMeter = permissions.includes('metering:read') || permissions.includes('reports:read');
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [myCount, setMyCount] = useState(0);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [quota, setQuota] = useState(null);
  const contextProjectId = useContextProjectId();
  const prefs = useTablePrefs('overview-recent', OVERVIEW_COLS);

  function load() {
    setLoading(true);
    setError('');
    Promise.all([
      api(governanceSummaryPath(contextProjectId)),
      api(approvalsListPath({ projectId: contextProjectId || undefined })).catch(() => ({ items: [] })),
      api('/approvals?scope=mine').catch(() => ({ items: [] })),
      api(governanceActivityPath(contextProjectId, 6)).catch(() => ({ items: [] })),
      canMeter ? api('/quotas/evaluate').catch(() => null) : Promise.resolve(null),
    ])
      .then(([summary, queue, mine, act, quotaBody]) => {
        setData(summary);
        setRecent((queue.items || []).slice(0, 5));
        setMyCount((mine.items || []).length);
        setActivity((act.items || []).slice(0, 6));
        setQuota(quotaBody || summary?.quota || null);
        setUpdatedAt(new Date());
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    window.addEventListener('qre-role-changed', load);
    window.addEventListener('qre-context-changed', load);
    return () => {
      window.removeEventListener('qre-role-changed', load);
      window.removeEventListener('qre-context-changed', load);
    };
  }, [contextProjectId]);

  const subtitle =
    !data && !loading
      ? 'Admission dashboard for institutional quantum resource governance.'
      : view === 'researcher'
        ? `Your admission queue and approvals — policy ${data?.policy_id}.`
        : view === 'operator'
          ? `Fleet posture and meter-backed capacity — ${data?.providers_active ?? 0} active providers.`
          : contextProjectId
            ? `Scoped to project ${contextProjectId.slice(0, 8)}… · policy ${data?.policy_id} · ${data?.stage_count} stage${data?.stage_count === 1 ? '' : 's'}.`
            : `Policy ${data?.policy_id} · version ${data?.policy_version} · ${data?.stage_count} review stage${data?.stage_count === 1 ? '' : 's'}. Approving here records governance only — it does not start a provider job.`;

  return (
    <GovernPageShell
      variant="band"
      title="Overview"
      subtitle={subtitle}
      loading={loading && !data}
      error={error}
      onRetry={load}
      onOpen={onOpen}
      loadingLabel="Loading admission dashboard…"
      updatedAt={updatedAt ? relativeTime(updatedAt) : ''}
      actions={
        data ? (
          <button type="button" className="qre-btn qre-btn--primary" onClick={() => onOpen('#/queue')}>
            Open queue
            <ArrowRight size={16} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
          </button>
        ) : null
      }
    >
      {data ? (
        <>
      <KpiStrip
        items={[
          { key: 'waiting', label: 'Waiting', value: data.queue ?? 0, hint: 'Open queue', onClick: () => onOpen('#/queue') },
          { key: 'mine', label: 'My work', value: myCount, hint: 'Assigned to you', onClick: () => onOpen('#/my-work') },
          { key: 'assets', label: 'Assets', value: data.inventory_assets ?? 0, hint: 'Inventory', onClick: () => onOpen('#/inventory') },
          ...(view === 'operator' || view === 'admin'
            ? [{
                key: 'providers',
                label: 'Active providers',
                value: data.providers_active ?? 0,
                hint: `${data.providers_total ?? 0} in catalogue`,
                onClick: () => onOpen('#/connectors'),
              }]
            : []),
          ...(canMeter && (view === 'operator' || view === 'admin')
            ? [{
                key: 'meters',
                label: 'Meter samples (24h)',
                value: data.meter_samples_24h ?? 0,
                hint: 'Capacity',
                onClick: () => onOpen('#/capacity'),
              }]
            : []),
        ]}
      />

      {(() => {
        const mix = mixFromCounts(data.counts);
        if (mix.preview) {
          return (
            <div className="qre-card">
              <EmptyState
                title="No admission mix yet"
                hint="Charts appear when the queue has live counts. KPI cards above stay at zero until submissions arrive."
              />
            </div>
          );
        }
        return (
          <div className="qre-card">
            <div className="govern-section-head">
              <h3 className="govern-section-title">Admission mix</h3>
              <span className="govern-muted">Live · current queue</span>
            </div>
            <DonutMix slices={mix.slices} />
          </div>
        );
      })()}

      {quota?.daily_shots_cap ? (
        <QuotaMeter
          used={quota.used_shots}
          cap={quota.daily_shots_cap}
          remaining={quota.remaining_shots}
          warnPct={quota.warn_threshold_pct ?? 20}
        />
      ) : null}

      <KpiStrip
        items={KPI.map((card) => ({
          key: card.key,
          label: labelState(card.state),
          value: data.counts?.[card.key] ?? 0,
          hint: 'Filter queue',
          tone: card.tone,
          onClick: () => onOpen(`#/queue?state=${card.state}`),
        }))}
      />

      <div className="govern-review-grid">
        <div className="qre-card">
          <div className="govern-section-head">
            <h3 className="govern-section-title">Needs review</h3>
            <span className="govern-status govern-status--warn">{data.queue} waiting</span>
            {recent.length > 0 ? (
              <ListViewToolbar prefs={prefs} columns={OVERVIEW_COLS} lockedIds={['workload']} />
            ) : null}
          </div>
          {recent.length === 0 ? (
            <EmptyState
              title="Queue is clear"
              hint="When a workload is submitted for institutional review, it lands here. Use Policies to dry-run stage routing first."
              action={
                <>
                  <button type="button" className="qre-btn qre-btn--primary" onClick={() => onOpen('#/queue')}>
                    Open queue
                  </button>
                  <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen('#/policies')}>
                    Policy dry-run
                  </button>
                </>
              }
            />
          ) : (
            <AdaptiveListView
              prefs={prefs}
              items={recent}
              columns={OVERVIEW_COLS}
              rowKey={(row) => row.submission_id}
              onRowClick={(row) => onOpen(`#/queue/${row.workload_id}`)}
              gridFields={approvalGridFields(onOpen, { actionLabel: 'Review' })}
              table={
              <div className="govern-table-wrap">
              <table className="govern-table">
                <thead>
                  <tr>
                    {prefs.isVisible('status') && <th>Status</th>}
                    {prefs.isVisible('workload') && <th>Workload</th>}
                    {prefs.isVisible('stage') && <th>Stage</th>}
                    {prefs.isVisible('actions') && <th />}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((item) => {
                    const stage = item.governance_progress?.current_stage?.label || 'Review';
                    const index = (item.governance_progress?.stage_index ?? 0) + 1;
                    const total = item.governance_progress?.stage_total || 1;
                    return (
                      <tr key={item.submission_id}>
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
                        {prefs.isVisible('stage') && (
                        <td>
                          {stage}
                          <span className="govern-table__sub">
                            {index} of {total}
                          </span>
                        </td>
                        )}
                        {prefs.isVisible('actions') && (
                        <td>
                          <button
                            type="button"
                            className="qre-btn qre-btn--ghost"
                            style={{ padding: '4px 10px', fontSize: 'var(--text-xs)' }}
                            onClick={() => onOpen(`#/queue/${item.workload_id}`)}
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
          {recent.length > 0 && (
            <button type="button" className="qre-btn qre-btn--ghost" style={{ marginTop: 12 }} onClick={() => onOpen('#/queue')}>
              View full queue
            </button>
          )}
        </div>

        <div className="qre-card">
          <div className="govern-section-head">
            <h3 className="govern-section-title">Resource posture</h3>
          </div>
          <div className="govern-meta-grid">
            <div className="govern-meta-item">
              <dt>Active providers</dt>
              <dd>
                {data.providers_active ?? 0} / {data.providers_total ?? 0}
              </dd>
            </div>
            <div className="govern-meta-item">
              <dt>Inventory records</dt>
              <dd>{data.inventory_assets ?? 0}</dd>
            </div>
            {canMeter && (view === 'operator' || view === 'admin') && (
              <div className="govern-meta-item">
                <dt>Meter samples (24h)</dt>
                <dd>{data.meter_samples_24h ?? 0}</dd>
              </div>
            )}
            {data.quota && view !== 'operator' && (
              <div className="govern-meta-item">
                <dt>Sim shots remaining</dt>
                <dd>
                  {data.quota.remaining_shots?.toLocaleString() ?? '—'}
                  <span className="govern-table__sub"> / {data.quota.daily_shots_cap?.toLocaleString()} cap</span>
                </dd>
              </div>
            )}
          </div>
          <p className="govern-muted" style={{ marginTop: 16 }}>
            Hardware dispatch checks provider manifest and suspension state. Simulated paths stay separate from QPU inventory.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen('#/providers')}>
              Providers
            </button>
            <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen('#/inventory')}>
              Inventory
            </button>
            {(view === 'admin' || permissions.includes('approvals:decide')) && (
              <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen('#/allocation')}>
                Allocation
              </button>
            )}
            <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen('#/audit')}>
              Audit
            </button>
            {view !== 'operator' && (
              <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen('#/usage')}>
                Usage
              </button>
            )}
            {canMeter && (view === 'operator' || view === 'admin') && (
              <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen('#/capacity')}>
                Capacity
              </button>
            )}
          </div>
        </div>
      </div>

      {activity.length > 0 && (
        <div className="qre-card">
          <div className="govern-section-head">
            <h3 className="govern-section-title">Recent governance activity</h3>
            <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen('#/audit')}>
              Full audit
            </button>
          </div>
          <ul className="qre-activity-list">
            {activity.map((ev) => (
              <li key={ev.id} className="qre-activity-list__item">
                <span className="govern-muted" title={ev.timestamp ? new Date(ev.timestamp).toLocaleString() : ''}>
                  {relativeTime(ev.timestamp) || (ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '')}
                </span>
                <div style={{ marginTop: 4 }}>
                  <strong>{ev.actor}</strong> · {ev.action?.replace('approval.', '')} · {ev.target_id?.slice(0, 8)}…
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
        </>
      ) : null}
    </GovernPageShell>
  );
}
