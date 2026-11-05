import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { usePermissions } from '../hooks/usePermissions.js';
import { formatIST } from '../utils/time';
import { SevBadge, StatusBadge } from './opsShared.jsx';
import { qubitOf, timelineTo } from './opsHelpers.js';
import { notifyError, notifySuccess } from '../lib/toast.js';
import { ConfirmDialog } from '../components/observability/ConfirmDialog.jsx';
import { CollapsibleSection } from '../components/observability/CollapsibleSection.jsx';
import { DiscussionModal } from '../components/observability/DiscussionModal.jsx';
import { buildBackendDetailsPath, buildDriftInvestigationLocation } from '../lib/investigationLinks.js';
import './IncidentDetailPage.css';

const num = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(1));

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

  const load = useCallback(async () => {
    if (!alertId) return;
    setLoading(true);
    try {
      const data = await api.getAlert(alertId);
      setAlert(data);
      setError(null);
    } catch (e) {
      setError(e?.message || 'Failed to load alert');
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => { load(); }, [load]);

  const comments = alert?.comments || [];
  const timeline = useMemo(() => buildAlertTimeline(alert, comments), [alert, comments]);

  const thresholdChart = useMemo(() => {
    if (!alert || alert.threshold_value == null || alert.current_value == null) return null;
    const thr = Number(alert.threshold_value);
    const obs = Number(alert.current_value);
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 16, top: 24, bottom: 28 },
      xAxis: { type: 'category', data: ['Threshold', 'Observed'] },
      yAxis: { type: 'value', name: 'µs' },
      series: [{
        type: 'bar',
        data: [thr, obs],
        itemStyle: { color: (p) => (p.dataIndex === 1 && obs > thr ? '#f43f5e' : '#38bdf8') },
        label: { show: true, position: 'top', formatter: ({ value }) => `${Number(value).toFixed(1)}` },
      }],
    };
  }, [alert]);

  const ratio = alert?.threshold_value
    ? Math.min(1.5, Math.max(0, alert.current_value / alert.threshold_value))
    : null;

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

  return (
    <div className="inc-detail page-stack">
      <div className="inc-detail__toolbar">
        <button type="button" className="btn btn-secondary btn--xs" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden /> Back to alerts
        </button>
        <span className="admin-mono inc-detail__id">{alert.alert_id}</span>
      </div>

      <header className="card inc-detail__hero">
        <div className="inc-detail__hero-top">
          <div>
            <h2 className="inc-detail__title">{alert.alert_type}</h2>
            <p className="page-hint">{alert.backend_id}{qubit ? ` · ${qubit}` : ''}</p>
          </div>
          <div className="inc-detail__badges">
            <SevBadge severity={alert.severity} />
            <StatusBadge status={alert.status} />
          </div>
        </div>
        <p className="inc-detail__summary">{alert.message}</p>
        <dl className="inc-detail__kpis">
          <div><dt>Observed</dt><dd>{num(alert.current_value)} µs</dd></div>
          <div><dt>Threshold</dt><dd>{num(alert.threshold_value)} µs</dd></div>
          <div><dt>Resource</dt><dd>{alert.resource_type} · {alert.resource_id || '—'}</dd></div>
          <div><dt>Detected (IST)</dt><dd>{formatIST(alert.detected_at, false)}</dd></div>
        </dl>
        <div className="inc-detail__actions">
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
          {alert.incident_id && onOpenIncident && (
            <button type="button" className="btn btn-secondary" onClick={() => onOpenIncident(alert.incident_id)}>
              Open incident workspace
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => (onInvestigateTimeline
              ? onInvestigateTimeline(alert)
              : nav(timelineTo({ backendId: alert.backend_id, at: alert.detected_at })))}
          >
            Timeline
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => (onInvestigateDrift
              ? onInvestigateDrift(alert)
              : nav(buildDriftInvestigationLocation(alert.backend_id, alert.detected_at)))}
          >
            Drift
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => (onOpenBackend
              ? onOpenBackend(alert.backend_id)
              : nav(buildBackendDetailsPath(alert.backend_id, 'qubits')))}
          >
            Backend qubits
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setDiscOpen(true)}>
            Discussion ({comments.length})
          </button>
        </div>
      </header>

      <div className="inc-detail__grid">
        <CollapsibleSection id="al-tl-h" title="Activity timeline" className="card inc-detail__panel" defaultOpen={timeline.length <= 4}>
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

        <CollapsibleSection id="al-chart-h" title="Threshold vs observed" className="card inc-detail__panel" defaultOpen>
          {thresholdChart ? (
            <QtECharts option={thresholdChart} style={{ height: 220, width: '100%' }} />
          ) : (
            <p className="page-hint">No numeric threshold data.</p>
          )}
          {ratio != null && (
            <div className="al-meter al-meter--detail" role="img" aria-label={`Observed ${num(alert.current_value)}, threshold ${num(alert.threshold_value)}`}>
              <span className="al-meter__fill" style={{ width: `${(ratio / 1.5) * 100}%` }} />
              <span className="al-meter__tick" style={{ left: `${(1 / 1.5) * 100}%` }} aria-hidden />
            </div>
          )}
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
