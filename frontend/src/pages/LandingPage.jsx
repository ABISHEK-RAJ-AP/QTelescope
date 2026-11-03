import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
  Cpu,
  Activity,
  Layers,
  LineChart,
  BellRing,
  ShieldAlert,
  Zap,
  Radio,
  Server,
  Terminal,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { QuantumBackground } from '@/components/ui/quantum-background'
import KineticMatrix from '@/components/ui/kinetic-matrix'
import PathDrawingPortfolioHero from '@/components/ui/path-drawing-portfolio-hero'
import { PublicMarketingHeader } from '@/components/marketing/PublicMarketingHeader'
import { PublicMarketingFooter } from '@/components/marketing/PublicMarketingFooter'
import { cn } from '@/lib/utils'

const CAPABILITIES = [
  {
    icon: Activity,
    title: 'Live Telemetry & Ingestion',
    body: 'Continuous streaming of multi-qubit error rates, readout fidelity, and dynamic status through resilient SSE streams.',
  },
  {
    icon: Cpu,
    title: 'Physical Qubit Topologies',
    body: 'Inspect 2D layout couplings, coherence drift (T1/T2), single-qubit and two-qubit gate fidelities on actual QPU hardware.',
  },
  {
    icon: Layers,
    title: 'Multi-Backend Inventory',
    body: 'Centralized registry across IBM Quantum Eagle/Heron processors, C-DAC testbeds, and local offline simulators.',
  },
]

const FEATURES = [
  {
    icon: LineChart,
    title: 'Calibration Drift Analysis',
    body: 'Statistical tracking of frequency shifts and relaxation decay against golden baseline thresholds.',
  },
  {
    icon: Radio,
    title: 'Real-time Queue & Job Ops',
    body: 'Track job queues, pending execution cycles, error-state jobs, and backend availability per workload.',
  },
  {
    icon: BellRing,
    title: 'Adaptive Incident Alarming',
    body: 'Automatic triggering of warning and critical operational alerts when qubits degrade past SLA limits.',
  },
  {
    icon: Server,
    title: 'Offline Resilient Cache',
    body: 'High-availability architecture capable of local playback and snapshot preservation during network disconnects.',
  },
  {
    icon: ShieldAlert,
    title: 'Fail-safe Calibration Snapshots',
    body: 'Versioned calibration captures with freshness clocks (Fresh / Aging / Stale) so jobs never ride a drifted QPU silently.',
  },
  {
    icon: Zap,
    title: 'Automated Health Scoring',
    body: 'Composite hardware health score computed dynamically from live error metrics, queue wait times, and calibration freshness.',
  },
]

const WORKFLOW_STEPS = [
  {
    n: '01',
    title: 'Connect Fleet Backends',
    body: 'Auto-discover or configure quantum hardware endpoints, C-DAC nodes, and local simulation engines.',
  },
  {
    n: '02',
    title: 'Stream Continuous Telemetry',
    body: 'Ingest live hardware snapshots, gate errors, and execution metrics into the telemetry engine.',
  },
  {
    n: '03',
    title: 'Detect Drift & Incidents',
    body: 'Evaluate qubit stability against calibration models to identify anomalies before job submission.',
  },
  {
    n: '04',
    title: 'Execute & Optimize Workloads',
    body: 'Route quantum circuits to the healthiest backends and generate audit-ready telemetry reports.',
  },
]

const FAQ = [
  {
    q: 'What is Q-TeleScope?',
    a: 'Q-TeleScope is an enterprise-grade quantum runtime observability and operations platform developed for superconducting QPU fleets, testbeds, and simulators.',
  },
  {
    q: 'How does it monitor physical qubits in real time?',
    a: 'Q-TeleScope streams calibration snapshots and telemetry via Server-Sent Events (SSE), calculating T1 relaxation, T2 dephasing, and gate fidelities continuously.',
  },
  {
    q: 'Can it run offline or in air-gapped laboratory environments?',
    a: 'Yes. Q-TeleScope incorporates resilient local caching and synthetic hardware telemetry generators so operations proceed seamlessly even without public internet connectivity.',
  },
  {
    q: 'How is calibration freshness used before job routing?',
    a: 'Each backend stores timestamped calibration snapshots. The console scores them Fresh, Recent, Aging, or Stale, and the health engine folds that age into the composite QPU score used for workload routing.',
  },
]

function FeatureCard({ icon: Icon, title, body }) {
  return (
    <article className="group relative rounded-2xl border border-neutral-200/80 bg-white/80 p-7 backdrop-blur-md transition-all duration-300 hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/5 hover:-translate-y-1 dark:border-neutral-800/80 dark:bg-neutral-900/60 dark:hover:border-cyan-400/50">
      {/* Standalone Icon without artificial background box/container */}
      <Icon className="size-8 text-cyan-600 dark:text-cyan-400 mb-4 transition-transform duration-300 group-hover:scale-110" />
      <h3 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-2.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        {body}
      </p>
    </article>
  )
}

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState(0)

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-[#f8fafc] text-neutral-900 dark:bg-[#070a0f] dark:text-neutral-100 transition-colors duration-200">
      <QuantumBackground />

      <PublicMarketingHeader />

      <section className="relative z-10 scroll-mt-28 px-6 py-16 sm:px-10 sm:py-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <div className="relative h-[min(72vh,640px)] w-full overflow-hidden rounded-3xl border border-neutral-200/90 shadow-2xl shadow-cyan-500/10 dark:border-neutral-800 dark:shadow-cyan-400/5">
            <KineticMatrix title="0x10" className="h-full w-full rounded-3xl" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/80 to-transparent p-8 pt-24 dark:from-[#070a0f] dark:via-[#070a0f]/85">
              <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col items-center text-center">
                <p className="landing-hero__eyebrow mb-3">Q-TeleScope</p>
                <p className="text-pretty text-sm text-neutral-600 dark:text-neutral-400 sm:text-base">
                  Quantum observability for superconducting QPUs — live telemetry, calibration drift, and fleet health.
                </p>
                <div className="mt-6 flex w-full max-w-lg flex-col gap-3 sm:flex-row sm:justify-center">
                  <Link to="/login" className="sm:min-w-[160px]">
                    <Button size="lg" className="w-full gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-600/25">
                      Sign in <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </Link>
                  <Link to="/register" className="sm:min-w-[160px]">
                    <Button size="lg" variant="outline" className="w-full font-semibold backdrop-blur-sm bg-white/80 dark:bg-neutral-950/50 border-neutral-300 dark:border-neutral-700">
                      Sign up
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div
            id="works"
            className="relative overflow-hidden rounded-3xl border border-neutral-200/90 bg-white/60 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/50"
          >
            <PathDrawingPortfolioHero
              compact
              brand="Q-TeleScope"
              tagline="Cert Studio–grade shell · light & dark aware"
              eyebrow="Path-drawn identity"
            />
          </div>
        </div>
      </section>

      <main className="relative z-20 mx-auto max-w-7xl space-y-28 px-6 pb-24 pt-4 sm:px-8">
        {/* Core Capabilities */}
        <section id="capabilities" className="scroll-mt-28">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-neutral-200/80 dark:border-neutral-800/80">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Core Telemetry Architecture</span>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
                Observability Beyond Traditional Monitoring
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              Capture hardware reality at microwave scale. Reconstruct operational provenance when quantum circuits fail or physical backends drift.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <FeatureCard key={item.title} {...item} />
            ))}
          </div>
        </section>

        {/* Modules Grid */}
        <section id="features" className="scroll-mt-28">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Comprehensive Modules</span>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              End-to-End Quantum System Governance
            </h2>
            <p className="text-base text-neutral-600 dark:text-neutral-400">
              Equipped with deep analytics for calibration drift, QPU topologies, job queues, and hardware safety.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((item) => (
              <FeatureCard key={item.title} {...item} />
            ))}
          </div>
        </section>

        {/* Workflow Steps */}
        <section id="workflow" className="scroll-mt-28 rounded-3xl border border-neutral-200/80 bg-white/70 p-8 sm:p-12 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-900/40">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Lifecycle Operations</span>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              Operational Workflow
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Continuous validation pipeline from hardware discovery to circuit execution.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((s) => (
              <div
                key={s.n}
                className="group rounded-2xl border border-neutral-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/50 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-950/70"
              >
                <span className="font-mono text-base font-extrabold text-cyan-600 dark:text-cyan-400">
                  {s.n}
                </span>
                <h3 className="mt-3 text-lg font-bold text-neutral-950 dark:text-white">{s.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive FAQ Accordion */}
        <section id="faq" className="scroll-mt-28 max-w-3xl mx-auto">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Technical FAQ</span>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="mt-10 divide-y divide-neutral-200/80 border-y border-neutral-200/80 dark:divide-neutral-800/80 dark:border-neutral-800/80">
            {FAQ.map((item, idx) => {
              const open = openFaq === idx
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 py-6 text-left text-base font-bold text-neutral-950 dark:text-white"
                    onClick={() => setOpenFaq(open ? -1 : idx)}
                    aria-expanded={open}
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={cn(
                        'size-5 shrink-0 text-neutral-400 transition-transform duration-200',
                        open && 'rotate-180 text-cyan-600 dark:text-cyan-400',
                      )}
                    />
                  </button>
                  {open ? (
                    <p className="pb-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                      {item.a}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-cyan-900/15 via-sky-900/10 to-purple-900/15 p-10 sm:p-14 text-center backdrop-blur-md">
          <div className="mx-auto max-w-2xl space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              Ready to Explore Quantum Telemetry?
            </h2>
            <p className="text-base text-neutral-600 dark:text-neutral-400">
              Access the live multi-backend operations console with sample IBM Brisbane and C-DAC testbed telemetries.
            </p>
            <div className="pt-4 flex flex-wrap justify-center gap-4">
              <Link to="/login">
                <Button size="lg" className="gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold">
                  Sign in <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="outline" className="font-semibold">
                  Sign up
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Cert Studio Footer */}
      <PublicMarketingFooter />
    </div>
  )
}

export default LandingPage
