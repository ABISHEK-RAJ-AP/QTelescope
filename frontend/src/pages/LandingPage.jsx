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
import { PublicMarketingHeader } from '@/components/marketing/PublicMarketingHeader'
import { PublicMarketingFooter } from '@/components/marketing/PublicMarketingFooter'
import { LandingChrome } from '@/components/marketing/LandingChrome'
import { QuantumFridge } from '@/components/marketing/QuantumFridge.jsx'
import '@/components/marketing/landing-chrome.css'
import { cn } from '@/lib/utils'

const CAPABILITIES = [
  {
    icon: Activity,
    title: 'Live telemetry',
    body: 'SSE streams of error rates, readout fidelity, and backend status.',
  },
  {
    icon: Cpu,
    title: 'Qubit topology',
    body: 'Coupling maps, T1/T2 drift, one-qubit and two-qubit gate fidelities.',
  },
  {
    icon: Layers,
    title: 'Backend inventory',
    body: 'IBM, Rigetti, IonQ, C-DAC/on-prem, and local simulators in one registry.',
  },
]

const FEATURES = [
  {
    icon: LineChart,
    title: 'Calibration drift',
    body: 'Frequency and relaxation vs the last accepted snapshot.',
  },
  {
    icon: Radio,
    title: 'Queues and jobs',
    body: 'Pending work, failed jobs, and backend availability.',
  },
  {
    icon: BellRing,
    title: 'Alerts',
    body: 'Warning and critical alerts when qubits pass configured limits.',
  },
  {
    icon: Server,
    title: 'Local cache',
    body: 'Playback of last snapshots when a vendor API is unreachable.',
  },
  {
    icon: ShieldAlert,
    title: 'Calibration snapshots',
    body: 'Timestamped captures scored Fresh, Aging, or Stale.',
  },
  {
    icon: Zap,
    title: 'Health score',
    body: 'Errors, queue wait, and calibration age on one score.',
  },
]

const WORKFLOW_STEPS = [
  {
    n: '01',
    title: 'Connect backends',
    body: 'API keys or on-prem URLs. Simulators need none.',
  },
  {
    n: '02',
    title: 'Collect telemetry',
    body: 'Snapshots, gate errors, and job metrics into the store.',
  },
  {
    n: '03',
    title: 'Watch drift',
    body: 'Compare live qubits against the last calibration.',
  },
  {
    n: '04',
    title: 'Operate',
    body: 'Alerts, incidents, and reports from the same catalog.',
  },
]

const FAQ = [
  {
    q: 'What is Q-TeleScope?',
    a: 'Operations console for superconducting QPU fleets, lab controllers, and simulators: telemetry, calibration, queues, and alerts.',
  },
  {
    q: 'How does live monitoring work?',
    a: 'Collectors poll vendor APIs and lab controllers. The UI streams updates over SSE (T1, T2, gate fidelity).',
  },
  {
    q: 'Does it work without internet?',
    a: 'Yes for on-prem URLs and cached snapshots. Cloud IBM/IonQ need network and keys.',
  },
  {
    q: 'How is calibration freshness used?',
    a: 'Each backend stores timestamped snapshots. The console marks them Fresh, Aging, or Stale and folds age into the health score.',
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
      <LandingChrome />

      <PublicMarketingHeader />

      {/* Dilution-fridge scroll hero — not KineticMatrix / 0x10 */}
      <QuantumFridge />

      <main className="relative z-20 mx-auto max-w-7xl space-y-28 px-6 pb-24 pt-4 sm:px-8">
        {/* Core Capabilities */}
        <section id="capabilities" className="scroll-mt-28">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-neutral-200/80 dark:border-neutral-800/80">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Console</span>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
                What you get
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              Live hardware metrics, calibration age, and inventory in one place.
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
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Modules</span>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              Calibration, queues, alerts
            </h2>
            <p className="text-base text-neutral-600 dark:text-neutral-400">
              Drift, topology, jobs, and collector health.
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
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Workflow</span>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              From connect to operate
            </h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Discover backends, collect telemetry, then work alerts.
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
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">FAQ</span>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              Questions
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
        <section className="rounded-lg border border-cyan-600/25 bg-white p-10 text-center dark:bg-slate-950 sm:p-14">
          <div className="mx-auto max-w-2xl space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              Open the console
            </h2>
            <p className="text-base text-neutral-600 dark:text-neutral-400">
              Sign in with a lab account. Demo backends appear when mock data is on.
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
