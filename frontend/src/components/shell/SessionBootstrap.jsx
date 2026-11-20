import React from 'react';
import { Loader2 } from 'lucide-react';
import { QuantumBackground } from '@/components/ui/quantum-background';
import { QtTeleScopeMark } from '@/components/brand/QtTeleScopeMark.jsx';

/** Shown while /auth/me confirms the bearer token after login or refresh. */
export function SessionBootstrap() {
  return (
    <div className="app-session-boot" role="status" aria-busy="true" aria-live="polite">
      <QuantumBackground />
      <div className="app-session-boot__card">
        <QtTeleScopeMark size={44} className="app-session-boot__logo" decorative />
        <div className="app-session-boot__skeleton" aria-hidden>
          <span className="skeleton-block app-session-boot__sk-line" />
          <span className="skeleton-block app-session-boot__sk-line app-session-boot__sk-line--short" />
          <span className="skeleton-block app-session-boot__sk-line app-session-boot__sk-line--med" />
        </div>
        <p className="app-session-boot__label">
          <Loader2 size={16} className="app-session-boot__spin" aria-hidden />
          Restoring your console
        </p>
      </div>
    </div>
  );
}

export default SessionBootstrap;