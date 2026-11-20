import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { QtTeleScopeMark } from '@/components/brand/QtTeleScopeMark.jsx'
import { AuthFridgeVisual } from '@/components/marketing/AuthFridgeVisual'
import { PublicMarketingHeader } from '@/components/marketing/PublicMarketingHeader'
import { QuantumBackground } from '@/components/ui/quantum-background'

/** Shared layout id for login / register / MFA / forgot / reset. */
export const AUTH_LAYOUT_ID = 'qt-auth-shell'

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-5xl',
  layout = 'split',
}) {
  const isCert = layout === 'cert';
  const isRegisterStudio = layout === 'register-studio';

  if (isRegisterStudio) {
    return (
      <div
        id={AUTH_LAYOUT_ID}
        className="auth-shell auth-shell--register-studio relative min-h-screen flex flex-col bg-[var(--bg-dark)]"
      >
        <QuantumBackground />
        <PublicMarketingHeader />
        <div className="reg-auth-main">
          <div className="reg-cert-panel">
            {children}
            {footer ? <div className="reg-cert-footer">{footer}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id={AUTH_LAYOUT_ID}
      className={`auth-shell relative min-h-screen flex flex-col bg-[var(--bg-dark)] text-[var(--text-primary)]${isCert ? ' auth-shell--cert' : ''}`}
    >
      <QuantumBackground />
      <PublicMarketingHeader />

      <main className={`relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6${isCert ? ' py-6' : ' py-10'}`}>
        {isCert ? (
          <div className={`auth-cert-card w-full ${maxWidth}`}>
            <QtTeleScopeMark size={44} className="auth-cert-card__logo-mark" decorative />
            <header className="auth-cert-card__head">
              <h1>{title}</h1>
              {subtitle ? <p className="auth-cert-card__subtitle">{subtitle}</p> : null}
            </header>
            {children}
            {footer ? <div className="auth-cert-card__footer">{footer}</div> : null}
          </div>
        ) : (
          <div
            className={`auth-shell__panel w-full ${maxWidth} grid grid-cols-1 lg:grid-cols-12 gap-0`}
          >
            <div className="auth-shell__brand lg:col-span-5 relative z-10 flex flex-col gap-4 p-6 sm:p-8 text-white min-h-[520px] lg:min-h-0 overflow-hidden">
              <div className="auth-shell__fridge flex-1 min-h-[280px] max-h-[340px] w-full flex items-stretch">
                <AuthFridgeVisual />
              </div>

              <div className="auth-shell__brand-copy mt-auto shrink-0 space-y-2 pt-1">
                <p className="auth-shell__product-name">Q-TeleScope</p>
                <h2 className="text-lg sm:text-xl font-semibold leading-[1.25] tracking-tight text-white">
                  Observability for superconducting QPU fleets
                </h2>
                <p className="text-sm leading-relaxed text-slate-400 max-w-[38ch]">
                  Coherence, calibration drift, and incidents — one console.
                </p>
                <Link
                  to="/"
                  className="pt-1 text-sm text-slate-500 hover:text-cyan-400 inline-flex items-center gap-1.5 min-h-11 transition-colors"
                >
                  <ArrowLeft className="size-3.5" aria-hidden /> Home
                </Link>
              </div>
            </div>

            <div className="auth-shell__form lg:col-span-7 relative z-10 flex flex-col justify-center p-6 sm:p-10 bg-[var(--bg-card)]">
              <div className="max-w-md w-full mx-auto space-y-5">
                <div>
                  <h1 className="text-[1.375rem] font-semibold tracking-tight text-[var(--text-primary)] text-balance">
                    {title}
                  </h1>
                  {subtitle ? (
                    <p className="mt-1.5 text-sm text-[var(--text-secondary)] max-w-[42ch] leading-relaxed">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                {children}
                {footer ? <div className="pt-3 border-t border-[var(--border-color)]">{footer}</div> : null}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export function Field({ label, forId, children, hint, className = '' }) {
  return (
    <div className={`auth-outline-field ${className}`.trim()}>
      <label htmlFor={forId} className="auth-outline-field__name">
        {label}
      </label>
      {children}
      {hint ? <p className="auth-outline-field__hint">{hint}</p> : null}
    </div>
  )
}

export const fieldClass =
  'auth-outline-field__control flex h-10 w-full min-w-0 bg-transparent px-1 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none'

export default AuthShell
