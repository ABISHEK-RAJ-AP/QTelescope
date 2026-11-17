import { labelWorkflowStep } from '../labels.js';

const STEPS = [
  { id: 'review', href: '#/queue?state=submitted_for_review' },
  { id: 'hold', href: '#/reservations?state=active' },
  { id: 'dispatch', href: '#/allocation', permission: 'approvals:decide' },
  { id: 'audit', href: '#/audit' },
];

/** Derive pipeline stage from hash path (e.g. App route key). */
export function lifecycleStageFromPath(path) {
  const p = (path || '/').replace(/^\//, '');
  if (p === 'queue' || p.startsWith('queue/')) return 'review';
  if (p === 'reservations' || p === 'schedule/hold' || p === 'holds') return 'hold';
  if (p === 'allocation') return 'dispatch';
  if (p === 'audit') return 'audit';
  return null;
}

export default function LifecycleStrip({ current, onOpen, permissions = [] }) {
  const visible = STEPS.filter(
    (step) => !step.permission || permissions.includes(step.permission) || permissions.includes('platform:manage'),
  );

  function go(href) {
    if (onOpen) onOpen(href);
    else window.location.hash = href;
  }

  return (
    <nav className="govern-lifecycle" aria-label="Governance pipeline">
      <ol className="govern-lifecycle__list">
        {visible.map((step, i) => {
          const active = step.id === current;
          const label = labelWorkflowStep(step.id);
          return (
            <li key={step.id} className="govern-lifecycle__item">
              {i > 0 ? <span className="govern-lifecycle__sep" aria-hidden="true">→</span> : null}
              <button
                type="button"
                className={`govern-lifecycle__step${active ? ' is-current' : ''}`}
                aria-current={active ? 'step' : undefined}
                aria-label={active ? `${label} (current step)` : `Go to ${label}`}
                onClick={() => go(step.href)}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ol>
      <span className="govern-lifecycle__hint govern-muted">Hold ≠ booking · Hold ≠ dispatch</span>
    </nav>
  );
}