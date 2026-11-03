import { useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ClipboardList,
  Database,
  FileSpreadsheet,
  Gauge,
  Layers,
  Network,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';
import QrePublicMarketingShell from '@qre-theme/QrePublicMarketingShell.jsx';
import QreMarketingContainer from '@qre-theme/QreMarketingContainer.jsx';
import QreStudioFeatureGrid from '@qre-theme/QreStudioFeatureGrid.jsx';
import { prefersReducedMotion } from '@qre-theme/motionPrefs.js';

const ICON = 22;

const CAPABILITIES = [
  {
    icon: <ClipboardList size={ICON} strokeWidth={1.75} />,
    accent: 'var(--primary)',
    title: 'Approval workflows',
    description: 'Queue, review, withdraw, and audit every transition on workload requests.',
  },
  {
    icon: <Database size={ICON} strokeWidth={1.75} />,
    accent: 'var(--accent)',
    title: 'Resource inventory',
    description: 'Providers, virtual pools, compatibility checks, CSV import, and dispatch evidence.',
  },
  {
    icon: <Gauge size={ICON} strokeWidth={1.75} />,
    accent: 'var(--success)',
    title: 'Quota & reservations',
    description: 'Operational shot ledger, preflight evaluate, and reservation holds per tenant.',
  },
];

const PORTAL_TOOLS = [
  {
    icon: <Scale size={ICON} strokeWidth={1.75} />,
    accent: 'var(--primary)',
    title: 'Policies & dry-run',
    description: 'Evaluate policy versions before approvals commit capacity decisions.',
  },
  {
    icon: <Network size={ICON} strokeWidth={1.75} />,
    accent: 'var(--warning)',
    title: 'Allocation & dispatch',
    description: 'Dispatch ICD handoff, authorize, and reconcile with connector evidence.',
  },
  {
    icon: <FileSpreadsheet size={ICON} strokeWidth={1.75} />,
    accent: 'var(--success)',
    title: 'Audit exports',
    description: 'CSV trails and release-evidence gates for programme reviews.',
  },
  {
    icon: <Users size={ICON} strokeWidth={1.75} />,
    accent: 'var(--accent)',
    title: 'Organizations & projects',
    description: 'Tenant-scoped context on queues, summaries, and audit filters.',
  },
];

/** Order matches 3-column bento: row of 3, then span-2 + 1. */
const BENTO = [
  {
    icon: <ShieldCheck size={20} strokeWidth={1.75} />,
    title: 'Provider health',
    desc: 'Connector maturity I1–I5 across the catalogue.',
    span: false,
  },
  {
    icon: <Layers size={20} strokeWidth={1.75} />,
    title: 'Virtual pools',
    desc: 'Group assets for allocation and compatibility checks.',
    span: false,
  },
  {
    icon: <Gauge size={20} strokeWidth={1.75} />,
    title: 'Usage metering',
    desc: 'Daily sim shot ledger with per-job contributions.',
    span: false,
  },
  {
    icon: <ClipboardList size={20} strokeWidth={1.75} />,
    title: 'My work & queue',
    desc: 'Researchers track submissions; approvers drain the queue.',
    span: true,
  },
  {
    icon: <Database size={20} strokeWidth={1.75} />,
    title: 'Reservations',
    desc: 'Hold windows on registered quantum resources.',
    span: false,
  },
];

const STEPS = [
  { n: '01', title: 'Register or sign in', desc: 'Use your Quantum Resource Engine account to open the Govern portal (local dev may use role headers when enabled).' },
  { n: '02', title: 'Submit for review', desc: 'Workloads enter the approval queue with policy version and project context pinned.' },
  { n: '03', title: 'Review & decide', desc: 'Operators run the approval FSM with dry-run, quota hints, and full decision history.' },
  { n: '04', title: 'Operate & evidence', desc: 'Track inventory, reservations, and usage; export audit records when capacity decisions must be demonstrated.' },
];

const FAQ = [
  {
    q: 'What is Govern?',
    a: 'Govern is the quantum resource portal on the Quantum Resource Engine (QRE). It is where operators and approvers manage access to quantum providers and pools, run approval workflows, apply policies and quotas, and produce audit evidence — not where circuits are authored or telemetry is observed.',
  },
  {
    q: 'Who can use it?',
    a: 'Researchers see queues and their submissions; approvers and resource managers decide and operate inventory; auditors export evidence. Navigation respects server-side permissions.',
  },
  {
    q: 'Where are quota and reservations?',
    a: 'Usage & metering shows the operational shot ledger; Reservations manages hold windows on registered resources. Both are tenant-scoped and backed by Govern APIs.',
  },
  {
    q: 'How does Govern relate to Q-Forge?',
    a: 'Q-Forge submits governed workload packages; Govern receives them in the approval queue with the same project scope for review and allocation.',
  },
];

export default function GovernLanding({ onSignIn, onRegister, onHome, onFooterNavigate }) {
  const heroTileRef = useRef(null);
  const [openFaq, setOpenFaq] = useState(null);

  function onHeroMouseMove(e) {
    if (prefersReducedMotion()) return;
    const el = heroTileRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty('--mouse-x', `${x}%`);
    el.style.setProperty('--mouse-y', `${y}%`);
  }

  function onHeroMouseLeave() {
    heroTileRef.current?.style.setProperty('--mouse-x', '50%');
    heroTileRef.current?.style.setProperty('--mouse-y', '40%');
  }

  const navigate = onFooterNavigate || ((hash) => {
    if (hash === '#/' || hash === '#/') onHome?.();
    else if (hash === '#/sign-in') onSignIn?.();
    else if (hash.startsWith('#')) {
      window.location.hash = hash;
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  return (
    <QrePublicMarketingShell onHome={onHome} onSignIn={onSignIn} onRegister={onRegister} onFooterNavigate={navigate}>
      <main id="main-content" tabIndex={-1}>
        <section className="landing-hero" aria-labelledby="landing-hero-title">
          <QreMarketingContainer className="landing-hero__container">
            <div className="landing-hero__float">
              <div
                ref={heroTileRef}
                className="landing-hero__glass-panel"
                onMouseMove={onHeroMouseMove}
                onMouseLeave={onHeroMouseLeave}
              >
                <div className="landing-hero__glass-glow" aria-hidden />
                <h1 id="landing-hero-title" className="landing-hero__title landing-hero__title--glass">
                  Quantum resource portal
                  <br />
                  <span className="landing-hero__title-accent">for allocation, access, and audit</span>
                </h1>
                <p className="landing-hero__lead landing-hero__lead--glass">
                  Govern is the C-DAC control plane on the Quantum Resource Engine — review workload requests, maintain
                  provider and pool inventory, enforce policies and quotas, and export evidence when quantum capacity must
                  be accountable.
                </p>
                <div className="landing-hero__ctas">
                  <button type="button" className="qre-btn qre-btn--primary landing-cta-primary" onClick={onRegister}>
                    Get Started <ArrowRight size={18} aria-hidden />
                  </button>
                  <button type="button" className="qre-btn qre-btn--ghost landing-cta-secondary--glass" onClick={onSignIn}>
                    Sign in
                  </button>
                </div>
              </div>
            </div>
          </QreMarketingContainer>
        </section>

        <section id="capabilities" className="landing-section landing-section--surface" aria-labelledby="capabilities-title">
          <QreMarketingContainer>
            <h2 id="capabilities-title" className="landing-section__title">
              What You Can Do
            </h2>
            <p className="landing-section__lead">
              Day-to-day portal tasks for resource managers, approvers, and auditors working with shared quantum capacity.
            </p>
            <QreStudioFeatureGrid items={CAPABILITIES} className="studio-feature-grid--tri" />
          </QreMarketingContainer>
        </section>

        <section id="features" className="landing-section" aria-labelledby="features-title">
          <QreMarketingContainer>
            <h2 id="features-title" className="landing-section__title">
              Portal tools
            </h2>
            <p className="landing-section__lead">
              Operational surfaces backed by Govern APIs — no placeholder metrics on production routes.
            </p>
            <QreStudioFeatureGrid items={PORTAL_TOOLS} className="studio-feature-grid--quad" />
          </QreMarketingContainer>
        </section>

        <section id="platform" className="landing-section landing-section--surface landing-glow-showcase" aria-labelledby="platform-title">
          <QreMarketingContainer>
            <h2 id="platform-title" className="landing-section__title">
              Platform coverage
            </h2>
            <p className="landing-section__lead">Modules you open after sign-in — each maps to a live workspace route.</p>
            <div className="landing-bento">
              {BENTO.map((item) => (
                <article
                  key={item.title}
                  className={`landing-bento__card${item.span ? ' landing-bento__card--span-2' : ''}`}
                >
                  <div className="landing-bento__icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </article>
              ))}
            </div>
          </QreMarketingContainer>
        </section>

        <section id="guide" className="landing-section" aria-labelledby="guide-title">
          <QreMarketingContainer>
            <h2 id="guide-title" className="landing-section__title">
              How It Works
            </h2>
            <div className="landing-steps">
              {STEPS.map((step) => (
                <div key={step.n} className="landing-step-card">
                  <div className="landing-step-card__num">{step.n}</div>
                  <div>
                    <h3 className="landing-step-card__title">{step.title}</h3>
                    <p className="landing-step-card__desc">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </QreMarketingContainer>
        </section>

        <section id="faq" className="landing-section landing-section--surface" aria-labelledby="faq-title">
          <QreMarketingContainer className="landing-faq-wrap">
            <h2 id="faq-title" className="landing-section__title">
              Frequently Asked Questions
            </h2>
            <div className="landing-faq-list">
              {FAQ.map((item, idx) => {
                const open = openFaq === idx;
                const panelId = `faq-panel-${idx}`;
                return (
                  <div key={item.q} className="landing-faq-item">
                    <button
                      type="button"
                      className="landing-faq-item__trigger"
                      onClick={() => setOpenFaq(open ? null : idx)}
                      aria-expanded={open}
                      aria-controls={panelId}
                    >
                      {item.q}
                      <ChevronDown size={20} className={`landing-faq-item__chev${open ? ' landing-faq-item__chev--open' : ''}`} aria-hidden />
                    </button>
                    {open ? (
                      <div id={panelId} className="landing-faq-item__body" role="region">
                        {item.a}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </QreMarketingContainer>
        </section>

        <section className="landing-section landing-section--cta" aria-labelledby="cta-title">
          <QreMarketingContainer>
            <div className="landing-final-cta">
              <h2 id="cta-title">Open the portal</h2>
              <p>Register or sign in with your Quantum Resource Engine credentials to manage quantum resources on Govern.</p>
              <div className="landing-hero__ctas">
                <button type="button" className="qre-btn qre-btn--primary landing-cta-primary" onClick={onRegister}>
                  Get Started
                </button>
                <button type="button" className="qre-btn qre-btn--ghost landing-cta-secondary--glass" onClick={onSignIn}>
                  Sign in
                </button>
              </div>
            </div>
          </QreMarketingContainer>
        </section>
      </main>
    </QrePublicMarketingShell>
  );
}
