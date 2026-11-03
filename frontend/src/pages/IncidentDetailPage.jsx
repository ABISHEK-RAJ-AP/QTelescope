import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { usePermissions } from '../hooks/usePermissions.js';
import { formatIST } from '../utils/time';
import { SevBadge, StatusBadge, RoleBadge } from './opsShared.jsx';
import { sevRank, qubitOf } from './opsHelpers.js';
import { notifyError, notifySuccess } from '../lib/toast.js';
import { ConfirmDialog } from '../components/observability/ConfirmDialog.jsx';
import {
  parseIncidentTitle,
  formatDurationMs,
  buildIncidentTimeline,
} from '../lib/incidentUi.js';
import { buildBackendDetailsPath } from '../lib/investigationLinks.js';
import { timelineTo } from './opsHelpers.js';
import './IncidentDetailPage.css';

const num = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(1));

export function IncidentDetailPage({ incidentId, currentUser, onBack, onOpenAlert }) {
  const nav = useNavigate();
  const perms = usePermissions(currentUser);
  const [inc, setInc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState(null);
  const actorName = currentUser?.username || currentUser?.full_name || 'operator';

  const load = useCallback(async () => {
    if (!incidentId) return;
    setLoading(true);
    try {
      const data = await api.getIncident(incidentId);
      setInc(data);
      setError(null);
    } catch (e) {
      setError(e?.message || 'Failed to load incident');
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => { load(); }, [load]);

  const { backendLabel, rule } = useMemo(() => parseIncidentTitle(inc?.title), [inc?.title]);
  const timeline = useMemo(() => buildIncidentTimeline(inc), [inc]);
  const alerts = inc?.alerts || [];
  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE').length;

  const sevChart = useMemo(() => {
    const counts = { CRITICAL: 0, WARNING: 0, INFO: 0 };
    alerts.forEach((a) => { counts[a.severity] = (counts[a.severity] || 0) + 1; });
    const data = Object.entries(counts).filter(([, n]) => n > 0).map(([name, value]) => ({ name, value }));
    if (!data.length) return null;
    return {
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['42%', '70%'],
        label: { fontSize: 11 },
        data,
        color: ['#f43f5e', '#f59e0b', '#38bdf8'],
      }],
    };
  }, [alerts]);

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
  if (error && !inc) return <ErrorState message={error} onRetry={load} />;
  if (!inc) return <ErrorState message="Incident not found." onRetry={onBack} />;

  const dur = formatDurationMs(
    new Date(inc.last_detected_at).getTime() - new Date(inc.first_detected_at).getTime(),
  );

  return (
    <div className="inc-detail page-stack">
      <div className="inc-detail__toolbar">
        <button type="button" className="btn btn-secondary btn--xs" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden /> Back to incidents
        </button>
        <span className="admin-mono inc-detail__id">{inc.incident_id}</span>
      </div>

      <header className="card inc-detail__hero">
        <div className="inc-detail__hero-top">
          <div>
            <h2 className="inc-detail__title">{backendLabel || inc.backend_id}</h2>
            <p className="page-hint">{rule} · {inc.backend_id}</p>
          </div>
          <div className="inc-detail__badges">
            <SevBadge severity={inc.severity} />
            <StatusBadge status={inc.status} />
          </div>
        </div>
        <p className="inc-detail__summary">{inc.summary || 'Correlated alerts for this backend and rule.'}</p>
        <dl className="inc-detail__kpis">
          <div><dt>Alerts</dt><dd>{inc.alert_count} <span className="al-sub">({activeAlerts} active)</span></dd></div>
          <div><dt>Duration</dt><dd>{dur}</dd></div>
          <div><dt>Owner</dt><dd>{inc.owner || inc.acknowledged_by || 'Unassigned'}</dd></div>
          <div><dt>Window</dt><dd>{formatIST(inc.first_detected_at, false)} → {formatIST(inc.last_detected_at, false)}</dd></div>
        </dl>
        <div className="inc-detail__actions">
          {inc.status === 'OPEN' && perms.canManageIncidents && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setDlg({
                title: 'Acknowledge incident?',
                body: inc.title,
                confirm: 'Acknowledge',
                input: 'Comment (optional)',
                required: false,
                defaultText: '',
                onConfirm: (text) => run(
                  () => api.acknowledgeIncident(inc.incident_id, {
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
          {inc.status === 'ACKNOWLEDGED' && perms.canManageIncidents && (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(() => api.investigateIncident(inc.incident_id), 'Investigating.')}>Start investigation</button>
          )}
          {inc.status !== 'RESOLVED' && perms.canResolveIncidents && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => setDlg({
                title: 'Resolve incident?',
                body: 'Linked alerts are not auto-resolved.',
                confirm: 'Resolve',
                danger: true,
                input: 'Resolution notes (optional)',
                required: false,
                defaultText: inc.resolution_notes || '',
                onConfirm: (text) => run(() => api.resolveIncident(inc.incident_id, text), 'Incident resolved.'),
              })}
            >
              Resolve
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => nav(timelineTo({ backendId: inc.backend_id, at: inc.last_detected_at }))}>Timeline</button>
          <button type="button" className="btn btn-secondary" onClick={() => nav(buildBackendDetailsPath(inc.backend_id, 'qubits'))}>Backend qubits</button>
        </div>
      </header>

      <div className="inc-detail__grid">
        <section className="card inc-detail__panel" aria-labelledby="inc-tl-h">
          <h3 id="inc-tl-h" className="al-h">Investigation timeline</h3>
          <ol className="inc-timeline">
            {timeline.length === 0 ? (
              <li className="page-hint">No timeline events yet.</li>
            ) : timeline.map((ev, i) => (
              <li key={`${ev.kind}-${ev.t}-${i}`} className={`inc-timeline__item inc-timeline__item--${ev.kind}`}>
                <time dateTime={new Date(ev.t).toISOString()}>{formatIST(new Date(ev.t).toISOString())}</time>
                <strong>{ev.title}</strong>
                <p>{ev.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="card inc-detail__panel" aria-labelledby="inc-sev-h">
          <h3 id="inc-sev-h" className="al-h">Related alerts by severity</h3>
          {sevChart ? <QtECharts option={sevChart} style={{ height: 200, width: '100%' }} /> : <p className="page-hint">No linked alerts loaded.</p>}
        </section>
      </div>

      <section className="card inc-detail__panel" aria-labelledby="inc-al-h">
        <h3 id="inc-al-h" className="al-h">Related alerts ({alerts.length})</h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Resource</th>
                <th>Status</th>
                <th>Observed vs threshold</th>
                <th>Detected</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr><td colSpan={5} className="page-hint">No alert rows linked in database.</td></tr>
              ) : [...alerts].sort((a, b) => sevRank(a.severity) - sevRank(b.severity)).map((a) => (
                <tr
                  key={a.alert_id}
                  className={onOpenAlert ? 'al-row-clickable' : undefined}
                  tabIndex={onOpenAlert ? 0 : undefined}
                  role={onOpenAlert ? 'button' : undefined}
                  onClick={onOpenAlert ? () => onOpenAlert(a.alert_id) : undefined}
                  onKeyDown={onOpenAlert ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenAlert(a.alert_id); } } : undefined}
                >
                  <td><SevBadge severity={a.severity} /></td>
                  <td>{qubitOf(a) || a.resource_id}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>{num(a.current_value)} µs <span className="al-sub">vs {num(a.threshold_value)}</span></td>
                  <td className="al-nowrap">{formatIST(a.detected_at, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card inc-detail__panel" aria-labelledby="inc-disc-h">
        <h3 id="inc-disc-h" className="al-h">Discussion ({(inc.comments || []).length})</h3>
        {(inc.comments || []).length === 0 ? <p className="page-hint">No comments yet.</p> : (
          <ul className="inc-comments">
            {(inc.comments || []).map((c, i) => (
              <li key={c.comment_id || i}>
                <div className="inc-comments__head">
                  <b>{c.author || 'operator'}</b>
                  <RoleBadge role={c.role} />
                </div>
                <time>{c.created_at ? formatIST(c.created_at) : ''}</time>
                <p>{c.text}</p>
              </li>
            ))}
          </ul>
        )}
        {perms.canComment ? (
          <form
            className="inc-comment-form"
            onSubmit={(e) => {
              e.preventDefault();
              const text = comment.trim();
              if (!text || busy) return;
              run(() => api.addIncidentComment(inc.incident_id, text).then(() => setComment('')), 'Comment posted.');
            }}
          >
            <label className="al-field">Add comment
              <textarea className="input-control" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Findings, hypothesis, next steps…" />
            </label>
            <p className="page-hint">Posted as <b>{actorName}</b> · role <RoleBadge role={currentUser?.role} /></p>
            <button type="submit" className="btn btn-primary" disabled={busy || !comment.trim()}>Post comment</button>
          </form>
        ) : (
          <p className="page-hint">Read-only — no comment permission.</p>
        )}
      </section>

      {dlg && (
        <ConfirmDialog
          dlg={dlg}
          busy={busy}
          onCancel={() => !busy && setDlg(null)}
          onConfirm={dlg.onConfirm}
        />
      )}
    </div>
  );
}
