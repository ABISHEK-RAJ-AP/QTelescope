import React from 'react'
import { Check, Info } from 'lucide-react'
import { COPY } from '@/copy/operator.js'

const STEPS = [
  { id: 'type', label: 'Type' },
  { id: 'org', label: 'Organisation' },
  { id: 'account', label: 'Account' },
  { id: 'otp', label: 'Verify' },
];

export function RegisterStepTrail({ current, requiresAdminApproval }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="reg-step-trail-wrap">
      <div className="reg-wizard-steps" role="list" aria-label="Registration progress">
        {STEPS.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          let cls = 'reg-wizard-step';
          if (done) cls += ' reg-wizard-step--done';
          else if (active) cls += ' reg-wizard-step--current';

          return (
            <span key={step.id} className={cls} role="listitem" aria-current={active ? 'step' : undefined}>
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
      {requiresAdminApproval && (current === 'account' || current === 'otp') ? (
        <button
          type="button"
          className="reg-step-trail__info"
          title={COPY.auth.registerApprovalNote}
          aria-label={COPY.auth.registerApprovalNote}
        >
          <Info className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}