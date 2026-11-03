import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import WorkloadTimeline from '@qre-theme/WorkloadTimeline.jsx';
import useReviewHotkeys from '../hooks/useReviewHotkeys.js';
import { api } from '../api.js';
import { labelState } from '../labels.js';
import PolicyDryRunSummary from '../components/PolicyDryRunSummary.jsx';
import ReviewQuotaHint from '../components/ReviewQuotaHint.jsx';
import GovernPageShell from '../components/GovernPageShell.jsx';
import { ConfirmDialog, StatusBadge, shortWorkloadId } from '../components/ui.jsx';
import { queueNeighbors } from '../lib/queueNav.js';

export default function Review({ workloadId, onBack, permissions = [], me = null, onOpen }) {
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeOk, setNoticeOk] = useState(false);
  const [timeline, setTimeline] = useState(null);
  const [notifyCfg, setNotifyCfg] = useState(null);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [policySim, setPolicySim] = useState(null);
  const [policySimBusy, setPolicySimBusy] = useState(false);
  const [policySimError, setPolicySimError] = useState('');
  const [quotaEval, setQuotaEval] = useState(null);
  const [pending, setPending] = useState(null);

  function load() {
    setLoading(true);
    return Promise.all([
      api(`/approvals/${workloadId}`),
      api(`/workloads/${workloadId}/timeline`).catch(() => null),
      api('/governance/notifications/config').catch(() => null),
      api(`/quotas/evaluate?workload_id=${encodeURIComponent(workloadId)}`).catch(() => null),
    ])
      .then(([body, tl, ncfg, quota]) => {
        setRow(body);
        setTimeline(tl);
        setNotifyCfg(ncfg);
        setQuotaEval(quota);
        setError('');
        const policyId = body?.governance_progress?.policy_id || 'default-two-stage';
        api(`/policies/${encodeURIComponent(policyId)}/dry-run`, {
          method: 'POST',
          body: JSON.stringify({ workload_id: workloadId }),
        })
          .then(setPolicySim)
          .catch((e) => setPolicySimError(String(e.message || e)));
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [workloadId]);

  async function runPolicySimulation() {
    const policyId = row?.governance_progress?.policy_id || 'default-two-stage';
    setPolicySimBusy(true);
    setPolicySimError('');
    try {
      const result = await api(`/policies/${encodeURIComponent(policyId)}/dry-run`, {
        method: 'POST',
        body: JSON.stringify({ workload_id: workloadId }),
      });
      setPolicySim(result);
    } catch (e) {
      setPolicySim(null);
      setPolicySimError(String(e.message || e));
    } finally {
      setPolicySimBusy(false);
    }
  }

  const neighbors = queueNeighbors(workloadId);

  const decide = useCallback(async (decision) => {
    if (!(permissions.includes('approvals:decide') || permissions.includes('platform:manage'))) {
      setNoticeOk(false);
      setNotice('Approvals:decide is required to record a decision.');
      return;
    }
    if (decision === 'changes_requested' && !comment.trim()) {
      setNoticeOk(false);
      setNotice('Add a comment explaining what must change.');
      return;
    }
    if (decision === 'reject') {
      setPending('reject');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const updated = await api(`/approvals/${workloadId}/decide`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          comment,
          expected_stage_id: row?.governance_progress?.current_stage?.id,
        }),
      });
      setNoticeOk(true);
      setNotice(`Recorded: ${labelState(updated.governance_state)}`);
      setComment('');
      await load();
    } catch (e) {
      setNoticeOk(false);
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }, [comment, permissions, row, workloadId]);

  const canWithdraw =
    row
    && (permissions.includes('approvals:withdraw') || row.created_by === me?.username)
    && ['submitted_for_review', 'in_review', 'pending_review', 'changes_requested'].includes(row.governance_state);

  async function withdrawSubmission() {
    setPending('withdraw');
  }

  async function confirmPending() {
    if (pending === 'reject') {
      setPending(null);
      setBusy(true);
      setNotice('');
      try {
        const updated = await api(`/approvals/${workloadId}/decide`, {
          method: 'POST',
          body: JSON.stringify({
            decision: 'reject',
            comment,
            expected_stage_id: row?.governance_progress?.current_stage?.id,
          }),
        });
        setNoticeOk(true);
        setNotice(`Recorded: ${labelState(updated.governance_state)}`);
        setComment('');
        await load();
      } catch (e) {
        setNoticeOk(false);
        setNotice(String(e.message || e));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (pending !== 'withdraw') return;
    setPending(null);
    setBusy(true);
    setNotice('');
    try {
      const updated = await api(`/approvals/${workloadId}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment.trim() || undefined }),
      });
      setNoticeOk(true);
      setNotice(`Withdrawn · ${labelState(updated.governance_state)}`);
      setComment('');
      await load();
    } catch (e) {
      setNoticeOk(false);
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  const decisionOpen =
    row != null
    && (row.governance_state === 'submitted_for_review'
      || row.governance_state === 'in_review'
      || row.governance_state === 'pending_review');
  const canDecide = permissions.includes('approvals:decide') || permissions.includes('platform:manage');
  const open = decisionOpen && canDecide;

  useReviewHotkeys({
    open: open && !loading,
    busy,
    onApprove: () => decide('approve'),
    onChanges: () => decide('changes_requested'),
    onReject: () => decide('reject'),
  });

  const progress = row?.governance_progress || {};
  const stageIndex = progress.stage_index ?? 0;
  const stageTotal = progress.stage_total || 0;

  async function copyWorkloadId() {
    try {
      await navigator.clipboard.writeText(workloadId);
      setNoticeOk(true);
      setNotice('Workload ID copied.');
    } catch {
      setNoticeOk(false);
      setNotice('Could not copy to clipboard.');
    }
  }

  return (
    <GovernPageShell
      title={row ? shortWorkloadId(workloadId) : 'Review'}
      subtitle={row ? `Workload ${workloadId}` : undefined}
      loading={loading && !row}
      error={error}
      notice={notice}
      noticeOk={noticeOk}
      onRetry={load}
      onOpen={onOpen}
      showContext={false}
      loadingLabel="Loading submission…"
      actions={
        <>
          <button type="button" className="qre-btn qre-btn--ghost qre-btn--sm" onClick={() => onBack('#/queue')}>
            Back to queue
          </button>
          {row ? <StatusBadge state={row.governance_state} /> : null}
          {row ? (
            <button type="button" className="qre-btn qre-btn--ghost qre-btn--sm" onClick={copyWorkloadId} title="Copy workload ID">
              <Copy size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Copy ID
            </button>
          ) : null}
        </>
      }
    >
      {row ? (
      <div className="govern-nav-siblings">
        {neighbors.prev || neighbors.next ? (
        <span className="govern-muted">Queue</span>
        ) : null}
        {neighbors.prev ? (
          <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen?.(`#/queue/${neighbors.prev}`)}>
            <ChevronLeft size={14} aria-hidden /> Previous
          </button>
        ) : null}
        {neighbors.next ? (
          <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen?.(`#/queue/${neighbors.next}`)}>
            Next <ChevronRight size={14} aria-hidden />
          </button>
        ) : null}
        {neighbors.total > 0 && neighbors.index >= 0 ? (
          <span className="govern-muted">
            {neighbors.index + 1} of {neighbors.total}
          </span>
        ) : null}
      </div>
      ) : null}

      {row ? (
        <>
      {row.governance_state === 'approved' && (
        <div className="qre-card govern-notice--ok" style={{ borderLeft: '4px solid var(--success)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
            Approved for governance. Dispatch eligibility and handoff are managed on{' '}
            <button type="button" className="govern-table__primary" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }} onClick={() => onBack('#/allocation')}>
              Allocation & orchestration
            </button>
            — execution still runs through Q-Forge / provider connectors.
          </p>
        </div>
      )}

      <ReviewQuotaHint quota={quotaEval} />

      {stageTotal > 0 && (
        <div className="qre-wizard-steps" role="list" aria-label="Review stages">
          {Array.from({ length: stageTotal }, (_, i) => {
            let cls = 'qre-wizard-step';
            if (i < stageIndex) cls += ' qre-wizard-step--done';
            else if (i === stageIndex) cls += ' qre-wizard-step--current';
            const label = i === stageIndex ? progress.current_stage?.label : `Stage ${i + 1}`;
            return (
              <span key={i} className={cls} role="listitem">
                {label || `Stage ${i + 1}`}
              </span>
            );
          })}
        </div>
      )}

      <div className="govern-review-grid">
        <div className="govern-stack">
          <div className="qre-card">
            <div className="govern-section-head">
              <h3 className="govern-section-title">Submission package</h3>
            </div>
            <dl className="govern-meta-grid">
              <div className="govern-meta-item">
                <dt>Requester</dt>
                <dd>{row.created_by}</dd>
              </div>
              {row.project_id && (
                <div className="govern-meta-item">
                  <dt>Project</dt>
                  <dd className="govern-mono" style={{ fontWeight: 400, fontSize: 'var(--text-xs)' }}>
                    {row.project_id}
                  </dd>
                </div>
              )}
              <div className="govern-meta-item">
                <dt>Current stage</dt>
                <dd>
                  {progress.current_stage?.label || '—'} ({stageIndex + 1} of {stageTotal})
                </dd>
              </div>
              <div className="govern-meta-item">
                <dt>Policy</dt>
                <dd>
                  {progress.policy_id} · v{String(progress.policy_version)}
                </dd>
              </div>
              <div className="govern-meta-item" style={{ gridColumn: '1 / -1' }}>
                <dt>Package SHA-256</dt>
                <dd className="govern-mono" style={{ fontWeight: 400 }}>
                  {row.package_sha256}
                </dd>
              </div>
            </dl>
          </div>

          <div className="qre-card">
            <div className="govern-section-head">
              <h3 className="govern-section-title">Policy simulation</h3>
              <button
                type="button"
                className="qre-btn qre-btn--ghost"
                disabled={policySimBusy}
                onClick={runPolicySimulation}
              >
                {policySimBusy ? 'Simulating…' : 'Run dry-run'}
              </button>
            </div>
            <p className="govern-muted" style={{ marginTop: 0 }}>
              Read-only evaluation against the active approval policy. No writes or side effects.
            </p>
            {policySimError && <p className="qre-alert">{policySimError}</p>}
            {policySim && <PolicyDryRunSummary result={policySim} />}
            {policySim && (
              <details style={{ marginTop: 12 }}>
                <summary className="govern-muted" style={{ fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                  Raw evaluation JSON
                </summary>
                <pre className="govern-code-block" style={{ marginTop: 8, fontSize: 'var(--text-xs)' }}>
                  {JSON.stringify(policySim, null, 2)}
                </pre>
              </details>
            )}
          </div>

          <div className="qre-card">
            <div className="govern-section-head">
              <h3 className="govern-section-title">Decision history</h3>
            </div>
            {(row.history || []).length === 0 && <p className="govern-muted">No decisions yet.</p>}
            <ul className="qre-activity-list">
              {(row.history || []).map((record) => (
                <li key={record.record_id} className="qre-activity-list__item">
                  <StatusBadge raw={record.decision} state={record.decision} />
                  <div className="govern-muted" style={{ marginTop: 8 }}>
                    {record.actor_username} · {record.stage_id}
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 'var(--text-sm)' }}>{record.comment || 'No comment'}</p>
                  <div className="govern-muted">{record.created_at ? new Date(record.created_at).toLocaleString() : ''}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="qre-card">
            <div className="govern-section-head">
              <h3 className="govern-section-title">Registry timeline</h3>
            </div>
            {notifyCfg && (
              <p className="govern-muted" style={{ marginTop: 0, marginBottom: 12 }}>
                Notifications: stub mode · subscribed events {notifyCfg.events?.length ?? 0}
                {Object.entries(notifyCfg.channels || {}).every(([, ch]) => !ch?.enabled) ? ' · no channels enabled' : ''}
              </p>
            )}
            <WorkloadTimeline
              timeline={timeline}
              filter={timelineFilter}
              emptyMessage="No events for this filter."
              filterSlot={
                <div className="qre-tabs" style={{ marginBottom: 12 }}>
                  {[
                    ['all', 'All'],
                    ['governance', 'Governance'],
                    ['development', 'Build'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`qre-tab${timelineFilter === id ? ' qre-tab--active' : ''}`}
                      onClick={() => setTimelineFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            />
          </div>
        </div>

        <div className={`qre-card govern-panel--decision`} style={{ position: 'sticky', top: 88 }}>
          <div className="govern-section-head">
            <h3 className="govern-section-title">Your decision</h3>
          </div>
          <p className="govern-muted">
            {decisionOpen && !canDecide
              ? 'You can inspect this package. Approvals:decide is required to record a decision.'
              : open
                ? 'Record approve, request changes, or reject for the current stage. Separation of duties applies on the server.'
                : 'This submission is not awaiting a decision in the current stage.'}
          </p>
          {open && (
            <p className="govern-muted" style={{ fontSize: 'var(--text-xs)', marginTop: 0 }}>
              Shortcuts: Alt+Shift+A approve · Alt+Shift+C request changes · Alt+Shift+R reject
            </p>
          )}
          <label className="qre-field">
            <span className="qre-field__label">Comment</span>
            <textarea
              className="qre-field__input"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Required when requesting changes"
            />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" className="qre-btn qre-btn--primary" disabled={!open || busy} onClick={() => decide('approve')}>
              Approve stage
            </button>
            <button type="button" className="qre-btn qre-btn--ghost" disabled={!open || busy} onClick={() => decide('changes_requested')}>
              Request changes
            </button>
            <button type="button" className="qre-btn qre-btn--accent" disabled={!open || busy} onClick={() => decide('reject')}>
              Reject
            </button>
            {canWithdraw && (
              <button type="button" className="qre-btn qre-btn--ghost" disabled={busy} onClick={withdrawSubmission}>
                Withdraw submission
              </button>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        title={pending === 'reject' ? 'Reject this submission?' : pending === 'withdraw' ? 'Withdraw submission?' : ''}
        body={
          pending === 'reject'
            ? 'Reject records a terminal governance decision for this stage. The requester must submit again.'
            : pending === 'withdraw'
              ? 'Withdraw pulls this package out of review. Build can edit again after the lock clears.'
              : ''
        }
        confirmLabel={pending === 'reject' ? 'Reject' : 'Withdraw'}
        danger
        onCancel={() => setPending(null)}
        onConfirm={confirmPending}
      />
        </>
      ) : null}
    </GovernPageShell>
  );
}
