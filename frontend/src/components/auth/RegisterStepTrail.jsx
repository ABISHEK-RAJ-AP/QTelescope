import React from 'react'
import { Info } from 'lucide-react'
import { COPY } from '@/copy/operator.js'

const STEPS = [
  { id: 'type', label: 'Type', short: 'Type' },
  { id: 'org', label: 'Organisation', short: 'Org' },
  { id: 'account', label: 'Account', short: 'Account' },
  { id: 'otp', label: 'Verify', short: 'Verify' },
];

export function RegisterStepTrail({ current, requiresAdminApproval }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="reg-step-trail-wrap">
      <nav className="reg-step-trail" aria-label="Registration progress">
        <ol className="reg-step-trail__list">
          {STEPS.map((step, i) => {
            const done = i < currentIdx;
            const active = step.id === current;
            return (
              <li
                key={step.id}
                className={`reg-step-trail__step${active ? ' reg-step-trail__step--active' : ''}${done ? ' reg-step-trail__step--done' : ''}`}
                aria-current={active ? 'step' : undefined}
              >
                <span className="reg-step-trail__num" aria-hidden>
                  {i + 1}
                </span>
                <span className="reg-step-trail__text reg-step-trail__text--full">{step.label}</span>
                <span className="reg-step-trail__text reg-step-trail__text--short">{step.short}</span>
                {i < STEPS.length - 1 ? (
                  <span className="reg-step-trail__connector" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>
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