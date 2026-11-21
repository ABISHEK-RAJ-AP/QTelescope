import React, { useEffect, useRef, useState } from 'react'
import { usePublicFilmReady } from '@/hooks/usePublicFilmReady.js'
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
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { QuantumBackground } from '@/components/ui/quantum-background'
import { PublicMarketingHeader } from '@/components/marketing/PublicMarketingHeader'
import { PublicMarketingFooter } from '@/components/marketing/PublicMarketingFooter'
import { LandingChrome } from '@/components/marketing/LandingChrome'
import '@/components/marketing/landing-chrome.css'
import { cn } from '@/lib/utils'
import { COPY } from '@/copy/operator.js'
import { usePublicRegistration } from '@/lib/usePublicRegistration'

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
    <article className="landing-tile group">
      <Icon className="landing-tile__icon" aria-hidden />
      <h3 className="landing-tile__title">{title}</h3>
      <p className="landing-tile__body">{body}</p>
    </article>
  )
}

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState(0)
  const { allowed: registrationOpen } = usePublicRegistration()
  usePublicFilmReady('landing')
  const mainRef = useRef(null)

  useEffect(() => {
    const root = mainRef.current
    if (!root) return undefined
    const nodes = root.querySelectorAll('.landing-reveal')
    if (!nodes.length) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      nodes.forEach((n) => n.classList.add('is-visible'))
      return undefined
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('is-visible')
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    nodes.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-[var(--bg-dark)] text-neutral-900 dark:text-neutral-100 transition-colors duration-200" data-qt-public="landing">
      <QuantumBackground />
      <LandingChrome />

      <PublicMarketingHeader />

      {/* Title + QuantumBackground dots only — no KineticMatrix / 0x10, no scroll fridge */}
      <section className="landing-hero landing-hero--static relative z-10 flex w-full scroll-mt-28 flex-col items-center justify-center px-6 py-20 sm:px-10 sm:py-28 lg:py-32 text-center min-h-[min(90vh,920px)]">
        <p className="landing-hero__eyebrow">Q-TeleScope</p>
        <h1 className="landing-hero__title text-balance max-w-6xl">
          Quantum observability for{' '}
          <span className="landing-hero__accent">superconducting QPUs</span>
        </h1>
        <p className="landing-hero__lead mt-10 max-w-3xl text-pretty">
          Monitor T1 and T2 coherence, gate fidelity, calibration drift, and incidents for multi-backend fleets.
        </p>
        <div className="mt-14 flex w-full max-w-lg flex-col items-stretch gap-4 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-5">
          <Link to="/login" className="sm:min-w-[188px]">
            <Button size="lg" className="w-full min-h-[3.25rem] gap-2.5 bg-cyan-600 px-10 py-7 text-lg font-semibold text-white shadow-lg shadow-cyan-600/25 hover:bg-cyan-500">
              Sign in <ArrowRight className="size-5" aria-hidden />
            </Button>
          </Link>
          {registrationOpen ? (
            <Link to="/register" className="sm:min-w-[188px]">
              <Button size="lg" variant="outline" className="w-full min-h-[3.25rem] border-neutral-300 bg-white/75 px-10 py-7 text-lg font-semibold backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-950/45">
                Sign up
              </Button>
            </Link>
          ) : null}
        </div>
        <p className="mt-8 text-sm text-neutral-500 dark:text-neutral-400">
          <Link to="/login" className="font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300">
            Sign in
          </Link>
          {registrationOpen ? (
            <>
              {' · '}
              <Link to="/register" className="font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300">
                Create an account
              </Link>
            </>
          ) : null}
        </p>
        <div className="landing-hero__fade pointer-events-none absolute inset-x-0 bottom-0 h-32" aria-hidden />
      </section>

      <main ref={mainRef} className="landing-main relative z-20 mx-auto max-w-7xl space-y-28 px-6 pb-24 pt-4 sm:px-8">
        {/* Core Capabilities */}
        <section id="capabilities" className="scroll-mt-28 landing-reveal">
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
        <section id="features" className="scroll-mt-28 landing-reveal">
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
        <section id="workflow" className="landing-workflow scroll-mt-28 landing-reveal p-8 sm:p-12">
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
              <div key={s.n} className="landing-tile landing-tile--step group">
                <span className="landing-tile__step">{s.n}</span>
                <h3 className="landing-tile__title">{s.title}</h3>
                <p className="landing-tile__body">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive FAQ Accordion */}
        <section id="faq" className="scroll-mt-28 landing-reveal max-w-3xl mx-auto">
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
        <section className="landing-cta p-10 text-center sm:p-14">
          <div className="mx-auto max-w-2xl space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              Open the console
            </h2>
            <p className="text-base text-neutral-600 dark:text-neutral-400">
              {COPY.landing.ctaBody}
            </p>
            <div className="pt-4 flex flex-wrap justify-center gap-4">
              <Link to="/login">
                <Button size="lg" className="gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold">
                  Sign in <ArrowRight className="size-4" />
                </Button>
              </Link>
              {registrationOpen ? (
                <Link to="/register">
                  <Button size="lg" variant="outline" className="font-semibold">
                    Sign up
                  </Button>
                </Link>
              ) : null}
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
