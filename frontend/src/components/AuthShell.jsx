import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import cdacLogo from '../assets/cdaclogo.png'
import { AuthFridgeVisual } from '@/components/marketing/AuthFridgeVisual'
import { PublicMarketingHeader } from '@/components/marketing/PublicMarketingHeader'
import { QuantumBackground } from '@/components/ui/quantum-background'

export function AuthShell({ title, subtitle, children, footer, maxWidth = 'max-w-5xl' }) {
  return (
    <div className="relative min-h-screen flex flex-col bg-[#f8fafc] text-neutral-900 dark:bg-[#070a0f] dark:text-neutral-100">
      <QuantumBackground />
      <PublicMarketingHeader />

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-10 sm:px-6">
        <div
          className={`w-full ${maxWidth} grid grid-cols-1 lg:grid-cols-12 gap-0 rounded-2xl border border-neutral-200/90 bg-white shadow-2xl dark:border-neutral-800 dark:bg-[#0c111a]`}
          style={{ overflow: 'clip' }}
        >
          <div
            className="lg:col-span-5 relative z-10 flex flex-col gap-3 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-neutral-800 text-white min-h-[560px] lg:min-h-0 overflow-hidden"
            style={{ backgroundColor: '#070b14' }}
          >
            <div className="flex items-center gap-2.5 shrink-0">
              <img src={cdacLogo} alt="" className="h-8 w-auto" />
              <span className="text-lg font-bold tracking-tight">Q-TeleScope</span>
            </div>

            <div className="flex-1 min-h-[280px] max-h-[340px] w-full flex items-center">
              <AuthFridgeVisual />
            </div>

            <div className="mt-auto shrink-0 space-y-2.5 pt-1">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-400/95">
                Q-TeleScope
              </p>
              <h2 className="text-lg sm:text-xl font-extrabold leading-[1.2] tracking-tight text-white">
                Quantum observability for superconducting QPUs
              </h2>
              <p className="text-sm leading-relaxed text-slate-400">
                T1 and T2 coherence, gate fidelity, calibration drift, and incidents for multi-backend fleets.
              </p>
              <Link
                to="/"
                className="pt-1 text-xs text-slate-500 hover:text-cyan-400 inline-flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="size-3" /> Home
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7 relative z-10 flex flex-col justify-center p-6 sm:p-10 bg-white dark:bg-[#0c111a]">
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
