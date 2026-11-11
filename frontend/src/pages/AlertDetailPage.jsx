import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { usePermissions } from '../hooks/usePermissions.js';
import { unableToLoad } from '../constants/messages.js';
import { formatIST } from '../utils/time';
import { SevBadge, StatusBadge } from './opsShared.jsx';
import { qubitOf, timelineTo } from './opsHelpers.js';
import { notifyError, notifySuccess } from '../lib/toast.js';
import { ConfirmDialog } from '../components/observability/ConfirmDialog.jsx';
import { CollapsibleSection } from '../components/observability/CollapsibleSection.jsx';
import { DiscussionModal } from '../components/observability/DiscussionModal.jsx';
import { buildBackendDetailsPath, buildDriftInvestigationLocation, buildLogsExplorerLocation } from '../lib/investigationLinks.js';
import { can, canManageFleet } from '../lib/permissions.js';
import { isMetricThresholdAlert, NON_METRIC_ALERT_TYPES } from '../lib/alertSemantics.js';
import { formatMetricValue } from '../lib/formatMetricValue.js';
import './IncidentDetailPage.css';
import './AlertDetailPage.css';

function formatObserved(alert) {
  if (NON_METRIC_ALERT_TYPES.has(alert.alert_type)) return 'N/A';
  return `${num(alert.current_value)} µs`;
}

function formatThreshold(alert) {
  if (NON_METRIC_ALERT_TYPES.has(alert.alert_type)) return 'N/A';
  return `${num(alert.threshold_value)} µs`;
}

const num = (v) => formatMetricValue(v, { decimals: 1, unit: 'µs' });

function buildAlertTimeline(alert, comments) {
  const events = [];
  if (alert?.detected_at) {
    events.push({
      kind: 'detect',
      t: alert.detected_at,
      title: 'Alert detected',
      detail: alert.message || alert.alert_type,
    });
  }
  if (alert?.status === 'ACKNOWLEDGED' && alert.acknowledged_by) {
    events.push({
      kind: 'ack',
      t: alert.detected_at,
      title: 'Acknowledged',
      detail: `By ${alert.acknowledged_by}`,
    });
  }
  if (alert?.resolved_at) {
    events.push({
      kind: 'resolve',
      t: alert.resolved_at,
      title: 'Resolved',
      detail: 'Alert marked resolved',
    });
  }
  (comments || []).forEach((c) => {
    events.push({
      kind: 'comment',
      t: c.created_at,
      title: `${c.author || 'operator'} commented`,
      detail: c.text,
    });
  });
  return events.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
}

export function AlertDetailPage({
  alertId,
  currentUser,
  onBack,
  onOpenIncident,
  onInvestigateTimeline,
  onInvestigateDrift,
  onOpenBackend,
}) {
  const nav = useNavigate();
  const perms = usePermissions(currentUser);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [discOpen, setDiscOpen] = useState(false);
  const [dlg, setDlg] = useState(null);
  const actorName = currentUser?.username || currentUser?.full_name || 'operator';
  const showLogs = canManageFleet(currentUser) || can(currentUser, 'platform:read');

  const load = useCallback(async () => {
    if (!alertId) return;
    setLoading(true);
    try {
      const data = await api.getAlert(alertId);
      setAlert(data);
      setError(null);
    } catch (e) {
      setError(e?.message || unableToLoad('this alert'));
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => { load(); }, [load]);

  const comments = alert?.comments || [];
  const timeline = useMemo(() => buildAlertTimeline(alert, comments), [alert, comments]);

  const metricStats = useMemo(() => {
    if (!alert || !isMetricThresholdAlert(alert)) return null;
    const thr = Number(alert.threshold_value);
    const obs = Number(alert.current_value);
    if (!Number.isFinite(thr) || !Number.isFinite(obs) || thr <= 0) return null;
    const margin = obs - thr;
    const pct = (100 * obs) / thr;
    const breached = obs < thr;
    return { thr, obs, margin, pct, breached };
  }, [alert]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      notifySuccess(okMsg);
      setDlg(null);
      await load();
    } catch (e) {
      notifyError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <BoneyardSkeleton layout="grid" />;
  if (error && !alert) return <ErrorState message={error} onRetry={load} />;
  if (!alert) return <ErrorState message="Alert not found." onRetry={onBack} />;

  const qubit = qubitOf(alert);
  const metric = isMetricThresholdAlert(alert);
  const headTitle = qubit ? `Qubit ${qubit}` : alert.backend_id;
  const headSub = qubit ? alert.backend_id : alert.alert_type.replace(/_/g, ' ');

  return (
    <div className="inc-detail page-stack">
      <div className="inc-detail__toolbar">
        <button type="button" className="btn btn-secondary btn--xs" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden /> Back to alerts
        </button>
        <span className="admin-mono inc-detail__id">{alert.alert_id}</span>
      </div>

      <header className="card al-detail__hero">
        <div className="al-detail__hero-top">
          <div>
            <p className="al-detail__type">{alert.alert_type.replace(/_/g, ' ')}</p>
            <h1 className="al-detail__title">{headTitle}</h1>
            <p className="page-hint" style={{ margin: '4px 0 0' }}>{headSub}{alert.resource_id ? ` · ${alert.resource_id}` : ''}</p>
          </div>
          <div className="inc-detail__badges">
            <SevBadge severity={alert.severity} />
            <StatusBadge status={alert.status} />
          </div>
        </div>
        <p className="al-detail__message">{alert.message}</p>
        <dl className="al-detail__facts">
          <div><dt>Backend</dt><dd>{alert.backend_id}</dd></div>
          <div><dt>Rule</dt><dd>{alert.alert_type}</dd></div>
          <div><dt>Resource</dt><dd>{alert.resource_type}{alert.resource_id ? ` · ${alert.resource_id}` : ''}</dd></div>
          <div><dt>Detected</dt><dd>{formatIST(alert.detected_at, false)}</dd></div>
          {metric && (
            <>
              <div><dt>Observed</dt><dd>{formatObserved(alert)}</dd></div>
              <div><dt>Threshold</dt><dd>{formatThreshold(alert)}</dd></div>
            </>
          )}
          {alert.acknowledged_by && (
            <div><dt>Acknowledged by</dt><dd>{alert.acknowledged_by}</dd></div>
          )}
          {alert.resolved_at && (
            <div><dt>Resolved</dt><dd>{formatIST(alert.resolved_at, false)}</dd></div>
          )}
          {alert.incident_id && (
            <div><dt>Incident</dt><dd><code>{alert.incident_id}</code></dd></div>
          )}
        </dl>

        {metricStats && (
          <div className="al-detail__metric">
            <div className="al-detail__metric-head">
              <span className={`al-detail__metric-verdict${metricStats.breached ? ' is-breach' : ''}`}>
                {metricStats.breached ? 'Below threshold' : 'Within threshold'}
              </span>
              <span className="page-hint">T1 coherence (µs)</span>
            </div>
            <div className="al-detail__metric-nums">
              <div>
                <span className="al-detail__metric-label">Observed</span>
                <strong className="al-detail__metric-val">{num(metricStats.obs)}</strong>
              </div>
              <div>
                <span className="al-detail__metric-label">Threshold</span>
                <strong className="al-detail__metric-val">{num(metricStats.thr)}</strong>
              </div>
              <div>
                <span className="al-detail__metric-label">Margin</span>
                <strong className={`al-detail__metric-val${metricStats.margin < 0 ? ' is-bad' : ''}`}>{num(metricStats.margin)}</strong>
              </div>
              <div>
                <span className="al-detail__metric-label">% of floor</span>
                <strong className="al-detail__metric-val">{metricStats.pct.toFixed(1)}%</strong>
              </div>
            </div>
            <div
              className="al-detail__metric-bar"
              role="img"
              aria-label={`Observed ${num(metricStats.obs)} µs versus threshold ${num(metricStats.thr)} µs`}
            >
              <span
                className="al-detail__metric-bar-fill"
                style={{ width: `${Math.min(100, (metricStats.obs / (Math.max(metricStats.thr, metricStats.obs) * 1.1)) * 100)}%` }}
              />
              <span
                className="al-detail__metric-bar-threshold"
                style={{ left: `${Math.min(100, (metricStats.thr / (Math.max(metricStats.thr, metricStats.obs) * 1.1)) * 100)}%` }}
                aria-hidden
              />
            </div>
          </div>
        )}
        <div className="al-detail__actions">
          <div className="al-detail__actions-primary">
          {alert.status === 'ACTIVE' && perms.canAckAlerts && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setDlg({
                title: 'Acknowledge alert?',
                body: alert.message,
                confirm: 'Acknowledge',
                input: 'Comment (optional)',
                required: false,
                defaultText: '',
                onConfirm: (text) => run(
                  () => api.acknowledgeAlert(alert.alert_id, {
                    acknowledged_by: actorName,
                    comment: (text || '').trim() || undefined,
                  }),
                  'Acknowledged.',
                ),
              })}
            >
              Acknowledge
            </button>
          )}
          {alert.status !== 'RESOLVED' && perms.canResolveAlerts && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => setDlg({
                title: 'Resolve alert?',
                body: alert.alert_id,
                confirm: 'Resolve',
                danger: true,
                input: 'Resolution notes (optional)',
                required: false,
                defaultText: '',
                onConfirm: (text) => run(
                  () => api.resolveAlert(alert.alert_id, text),
                  'Alert resolved.',
                ),
              })}
            >
              Resolve
            </button>
          )}
          </div>
          <nav className="al-detail__actions-nav" aria-label="Investigation">
          {alert.incident_id && onOpenIncident && (
            <button type="button" className="btn btn-secondary btn--xs" onClick={() => onOpenIncident(alert.incident_id)}>
              Incident workspace
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn--xs"
            onClick={() => (onInvestigateTimeline
              ? onInvestigateTimeline(alert)
              : nav(timelineTo({ backendId: alert.backend_id, at: alert.detected_at })))}
          >
            Timeline
          </button>
          {showLogs && (
            <button
              type="button"
              className="btn btn-secondary btn--xs"
              onClick={() => nav(buildLogsExplorerLocation({
                backendId: alert.backend_id,
                q: alert.backend_id || alert.alert_id,
                hours: 6,
                anchorAt: alert.detected_at,
                source: 'app',
              }))}
            >
              Logs
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn--xs"
            onClick={() => (onInvestigateDrift
              ? onInvestigateDrift(alert)
              : nav(buildDriftInvestigationLocation(alert.backend_id, alert.detected_at)))}
          >
            Drift
          </button>
          <button
            type="button"
            className="btn btn-secondary btn--xs"
            onClick={() => (onOpenBackend
              ? onOpenBackend(alert.backend_id)
              : nav(buildBackendDetailsPath(alert.backend_id, 'qubits')))}
          >
            Qubits
          </button>
          {perms.canComment && (
            <button type="button" className="btn btn-secondary btn--xs" onClick={() => setDiscOpen(true)}>
              Discussion ({comments.length})
            </button>
          )}
          </nav>
        </div>
      </header>

      <div className="al-detail__layout">
        <CollapsibleSection id="al-tl-h" title="Activity timeline" className="card inc-detail__panel" defaultOpen>
          <ol className="inc-timeline">
            {timeline.length === 0 ? (
              <li className="page-hint">No timeline events yet.</li>
            ) : timeline.map((ev, i) => (
              <li key={`${ev.kind}-${ev.t}-${i}`} className={`inc-timeline__item inc-timeline__item--${ev.kind}`}>
                <time dateTime={new Date(ev.t).toISOString()}>{formatIST(ev.t)}</time>
                <strong>{ev.title}</strong>
                <p>{ev.detail}</p>
              </li>
            ))}
          </ol>
        </CollapsibleSection>

      </div>

      <DiscussionModal
        open={discOpen}
        onClose={() => setDiscOpen(false)}
        title={`Discussion (${comments.length})`}
        comments={comments}
        canComment={perms.canComment}
        actorName={actorName}
        role={currentUser?.role}
        placeholder="Triage notes, owner handoff, mitigation…"
        busy={busy}
        onPost={(text) => run(() => api.addAlertComment(alert.alert_id, text), 'Comment posted.')}
      />

      {dlg && (
        <ConfirmDialog dlg={dlg} busy={busy} onCancel={() => !busy && setDlg(null)} onConfirm={dlg.onConfirm} />
      )}
    </div>
  );
}
