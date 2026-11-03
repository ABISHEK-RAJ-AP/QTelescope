import { labelState } from '../labels.js';

function decisionTone(decision) {
  if (decision === 'ALLOW') return 'govern-status govern-status--ok';
  if (decision === 'DENY') return 'govern-status govern-status--bad';
  return 'govern-status govern-status--warn';
}

export default function PolicyDryRunSummary({ result }) {
  if (!result) return null;
  const progress = result.progress || {};
  const stage = progress.current_stage;
  const reasons = result.reason_codes || [];

  return (
    <div className="govern-policy-dry-run">
      <div className="govern-policy-dry-run__head">
        <span className={decisionTone(result.decision)}>{result.decision}</span>
        <span className="govern-muted" style={{ fontSize: 'var(--text-xs)' }}>
          Read-only · no writes
        </span>
      </div>
      <dl className="govern-meta-grid" style={{ marginTop: 12 }}>
        <div className="govern-meta-item">
          <dt>Governance state</dt>
          <dd>{labelState(result.governance_state) || result.governance_state}</dd>
        </div>
        <div className="govern-meta-item">
          <dt>Policy</dt>
          <dd>
            {result.policy_id}
            {result.requested_policy_id && result.requested_policy_id !== result.policy_id
              ? ` (requested ${result.requested_policy_id})`
              : ''}
          </dd>
        </div>
        <div className="govern-meta-item">
          <dt>Current stage</dt>
          <dd>
            {stage?.label || '—'}
            {progress.stage_total ? ` · ${(progress.stage_index ?? 0) + 1} of ${progress.stage_total}` : ''}
          </dd>
        </div>
        <div className="govern-meta-item">
          <dt>Dispatch eligibility</dt>
          <dd>{result.would_approve ? 'Would allow (approved)' : 'Not yet eligible'}</dd>
        </div>
      </dl>
      {reasons.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p className="govern-muted" style={{ margin: '0 0 6px', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase' }}>
            Reason codes
          </p>
          <ul className="govern-reason-list">
            {reasons.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.evaluated_at && (
        <p className="govern-muted" style={{ marginTop: 12, marginBottom: 0, fontSize: 'var(--text-xs)' }}>
          Evaluated {new Date(result.evaluated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
