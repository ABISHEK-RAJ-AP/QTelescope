import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { api } from '../api.js';
import { useContextProjectId } from '../hooks/useContextProject.js';
import { approvalsListPath, governanceActivityPath, governanceSummaryPath } from '../lib/approvalsQuery.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import { buildQrpBreadcrumbs } from '../nav/qrpNav.js';
import OverviewDashboardGrid from '../components/OverviewDashboardGrid.jsx';
import { relativeTime } from '../lib/format.js';
import { useGovernSession } from '../hooks/useGovernSession.js';
import { resolveOverviewLens } from '../lib/overviewRoleLens.js';
export default function Overview({ onOpen, role: roleProp, permissions: permissionsProp }) {
  const session = useGovernSession();
  const role = roleProp ?? session.me?.role ?? 'Viewer';
  const permissions = permissionsProp ?? session.permissions ?? [];
  const lens = resolveOverviewLens(role, permissions);
  const canMeter = permissions.includes('metering:read') || permissions.includes('reports:read');
  const showQuota = lens === 'researcher' || lens === 'reviewer' || lens === 'platform_admin';
  const showAdmissionMix = lens !== 'auditor' && lens !== 'security';
  const activityFirst = lens === 'auditor' || lens === 'security';
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [myCount, setMyCount] = useState(0);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [stale, setStale] = useState(false);
  const [quota, setQuota] = useState(null);
  const contextProjectId = useContextProjectId();

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

  useEffect(() => {
    if (!updatedAt) {
      setStale(false);
      return undefined;
    }
    const tick = () => setStale(Date.now() - updatedAt.getTime() > 5 * 60 * 1000);
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [updatedAt]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return undefined;
    const id = setInterval(() => load(), 120_000);
    return () => clearInterval(id);
  }, [contextProjectId]);

  const subtitle =
    !data && !loading
      ? 'Governance summary for your tenant.'
      : lens === 'researcher'
        ? `Your submissions and review status — policy ${data?.policy_id}.`
        : lens === 'governance_ops'
          ? `Fleet posture and meter-backed capacity — ${data?.providers_active ?? 0} active providers.`
        : lens === 'auditor' || lens === 'security'
          ? `Governance decision volume and audit trail — policy ${data?.policy_id}.`
        : lens === 'reviewer'
          ? `Approvals waiting on your stage — policy ${data?.policy_id}.`
        : lens === 'viewer'
          ? `Read-only admission summary — policy ${data?.policy_id}.`
          : contextProjectId
            ? `Scoped to project ${contextProjectId.slice(0, 8)}… · policy ${data?.policy_id} · ${data?.stage_count} stage${data?.stage_count === 1 ? '' : 's'}.`
            : `Policy ${data?.policy_id} · version ${data?.policy_version} · ${data?.stage_count} review stage${data?.stage_count === 1 ? '' : 's'}. Approving here records governance only — it does not start a provider job.`;

  return (
    <GovernPageShell
      variant="band"
      breadcrumbs={buildQrpBreadcrumbs('workspace', 'Overview')}
      title="Overview"
      subtitle={subtitle}
      loading={loading && !data}
      error={error}
      onRetry={load}
      onOpen={onOpen}
      loadingLabel="Loading overview…"
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
      {stale ? (
        <div className="qre-card govern-notice--warn" style={{ padding: 12, marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
            Dashboard data may be stale.{' '}
            <button type="button" className="fs-link" onClick={load}>
              Refresh now
            </button>
          </p>
        </div>
      ) : null}

      {activityFirst && activity.length > 0 ? (
        <div className="qre-card" style={{ marginBottom: 12 }}>
          <div className="govern-section-head">
            <h3 className="govern-section-title">Recent governance activity</h3>
            <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen('#/audit')}>
              Full audit
            </button>
          </div>
          <ul className="qre-activity-list">
            {activity.map((ev) => (
              <li key={ev.id} className="qre-activity-list__item">
                <span className="govern-muted">{relativeTime(ev.timestamp)}</span>
                <div style={{ marginTop: 4 }}>
                  <strong>{ev.actor}</strong> · {ev.action?.replace('approval.', '')}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <OverviewDashboardGrid
        lens={lens}
        data={data}
        recent={recent}
        myCount={myCount}
        activity={activity}
        quota={quota}
        permissions={permissions}
        showAdmissionMix={showAdmissionMix}
        showQuota={showQuota}
        activityFirst={activityFirst}
        onOpen={onOpen}
      />
        </>
      ) : null}
    </GovernPageShell>
  );
}
