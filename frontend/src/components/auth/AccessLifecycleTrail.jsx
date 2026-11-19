import React from 'react';
import { Check } from 'lucide-react';
import '@/styles/register-cert.css';

/**
 * Cert Studio wizard pills — shared with public registration (`RegisterStepTrail`).
 * @param {{ steps: { id: string, label: string }[], currentId: string, ariaLabel?: string }} props
 */
export function AccessLifecycleTrail({ steps, currentId, ariaLabel = 'Progress' }) {
  const currentIdx = steps.findIndex((s) => s.id === currentId);

  return (
    <div className="reg-step-trail-wrap admin-access-trail">
      <div className="reg-wizard-steps" role="list" aria-label={ariaLabel}>
        {steps.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          let cls = 'reg-wizard-step';
          if (done) cls += ' reg-wizard-step--done';
          else if (active) cls += ' reg-wizard-step--current';

          return (
            <span
              key={step.id}
              className={cls}
              role="listitem"
              aria-current={active ? 'step' : undefined}
            >
              {done ? (
                <Check className="reg-wizard-step__check" strokeWidth={2.5} aria-hidden />
              ) : (
                <span className="reg-wizard-step__num" aria-hidden>{i + 1}</span>
              )}
              <span className="reg-wizard-step__label">{step.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export const REGISTRATION_REVIEW_STEPS = [
  { id: 'register', label: 'Register' },
  { id: 'verify', label: 'Verify email' },
  { id: 'approve', label: 'Approve' },
];

export const INVITE_LIFECYCLE_STEPS = [
  { id: 'details', label: 'Details' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'active', label: 'Active account' },
];