import React from 'react'
import { Info } from 'lucide-react'
import { COPY } from '@/copy/operator.js'

const STEPS = [
  { id: 'type', label: 'Type', full: 'Organisation type' },
  { id: 'org', label: 'Organisation', full: 'Organisation details' },
  { id: 'account', label: 'Account', full: 'Account' },
  { id: 'otp', label: 'Verify', full: 'Verify email' },
];

export function RegisterStepTrail({ current, requiresAdminApproval }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="reg-step-trail-wrap">
      <ol className="auth-register-steps reg-step-trail" aria-label="Registration progress">
        {STEPS.map((step, i) => {
          const done = i < currentIdx;
          const active = step.id === current;
          return (
            <li
              key={step.id}
              className={`auth-register-steps__item reg-step-trail__item${active ? ' auth-register-steps__item--active reg-step-trail__item--active' : ''}${done ? ' reg-step-trail__item--done' : ''}`}
              aria-current={active ? 'step' : undefined}
            >
              <span aria-hidden>{i + 1}</span>
              <span className="reg-step-trail__label">{step.label}</span>
            </li>
          );
        })}
      </ol>
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