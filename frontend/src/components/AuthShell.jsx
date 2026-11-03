import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import cdacLogo from '../assets/cdaclogo.png'
import { QuantumBackground } from '@/components/ui/quantum-background'
import { AuthFridgeVisual } from '@/components/marketing/AuthFridgeVisual'
import { PublicMarketingHeader } from '@/components/marketing/PublicMarketingHeader'

export function AuthShell({ title, subtitle, children, footer, maxWidth = 'max-w-5xl' }) {
  return (
    <div className="relative min-h-screen flex flex-col bg-[#f8fafc] text-neutral-900 dark:bg-[#070a0f] dark:text-neutral-100">
      <QuantumBackground />

      <PublicMarketingHeader />

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-10 sm:px-6">
        <div className={`w-full ${maxWidth} grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden rounded-2xl border border-neutral-200/70 bg-white/95 shadow-xl backdrop-blur-md dark:border-neutral-800/70 dark:bg-[#0c111a]/95`}>
          <div className="lg:col-span-5 flex flex-col p-7 sm:p-8 border-b lg:border-b-0 lg:border-r border-neutral-200/70 dark:border-neutral-800/70 bg-neutral-950 text-white">
            <div className="flex items-center gap-2.5 mb-6">
              <img src={cdacLogo} alt="" className="h-8 w-auto" />
              <span className="text-lg font-bold tracking-tight">Q-TeleScope</span>
            </div>

            <AuthFridgeVisual />

            <div className="mt-6 space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-400/95">
                Q-TeleScope
              </p>
              <h2 className="text-2xl sm:text-[1.75rem] font-extrabold leading-[1.12] tracking-tight text-white">
                Quantum observability for superconducting QPUs
              </h2>
              <p className="text-base sm:text-[1.0625rem] leading-relaxed text-slate-300/95">
                Monitor T1 and T2 coherence, gate fidelity, calibration drift, and incidents in one place — built for multi-backend quantum fleets.
              </p>
            </div>

            <Link
              to="/"
              className="mt-auto pt-6 text-xs text-slate-500 hover:text-cyan-400 inline-flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="size-3" /> Home
            </Link>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center p-6 sm:p-10">
            <div className="max-w-md w-full mx-auto space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">{title}</h1>
                {subtitle ? (
                  <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">{subtitle}</p>
                ) : null}
              </div>
              {children}
              {footer ? <div className="pt-4 border-t border-neutral-200/80 dark:border-neutral-800/80">{footer}</div> : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
        {label}
      </label>
      {children}
    </div>
  )
}

export const fieldClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-cyan-400'

export default AuthShell
