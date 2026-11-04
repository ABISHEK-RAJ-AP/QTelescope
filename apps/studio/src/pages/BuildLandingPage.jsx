import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Code2, CircuitBoard, FolderGit2, Layers, Play, Send, Settings2 } from 'lucide-react';
import CertPublicMarketingShell from '../cert-studio/CertPublicMarketingShell.jsx';
import CertContainer from '../cert-studio/CertContainer.jsx';
import StudioFeatureGrid from '../cert-studio/StudioFeatureGrid.jsx';

const ICON = 22;

const WHAT_YOU_CAN_DO = [
  {
    icon: <Code2 size={ICON} strokeWidth={1.75} />,
    accent: 'var(--primary)',
    title: 'Source & visual circuits',
    description: 'Monaco OpenQASM and a drag-and-drop composer with gate palette — one project, two editing surfaces.',
  },
  {
    icon: <Play size={ICON} strokeWidth={1.75} />,
    accent: 'var(--accent)',
    title: 'Simulate with quotas',
    description: 'Tenant-aware shot limits, histograms, and reproducibility manifests on every simulation run.',
  },
  {
    icon: <Send size={ICON} strokeWidth={1.75} />,
    accent: 'var(--warning)',
    title: 'Submit for governance',
    description: 'Package hash, compile/preflight evidence, and a single workload ID ready for institutional review.',
  },
];

const PLATFORM_FEATURES = [
  {
    icon: <CircuitBoard size={ICON} strokeWidth={1.75} />,
    accent: 'var(--primary)',
    title: 'Compile & preflight',
    description: 'Transpile and target checks before you burn shots or request institutional approval.',
  },
  {
    icon: <Layers size={ICON} strokeWidth={1.75} />,
    accent: 'var(--danger)',
    title: 'Workload timeline',
    description: 'Trace simulate → compile → submit steps on one rail inside the project workspace.',
  },
  {
    icon: <Settings2 size={ICON} strokeWidth={1.75} />,
    accent: 'var(--success)',
    title: 'Schema-driven settings',
    description: 'Project capabilities and editor preferences aligned with the platform feature catalog.',
  },
  {
    icon: <FolderGit2 size={ICON} strokeWidth={1.75} />,
    accent: 'var(--accent)',
    title: 'Cross-app project scope',
    description: 'Project scope and submission artifacts stay consistent from design through review packaging.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Create a project',
    desc: 'Start from a template or blank workspace with source and visual tabs ready.',
  },
  {
    n: '02',
    title: 'Design & simulate',
    desc: 'Edit OpenQASM or the visual graph, run simulation, inspect quotas and timeline.',
  },
  {
    n: '03',
    title: 'Compile & preflight',
    desc: 'Validate targets and packaging before governance submission.',
  },
  {
    n: '04',
    title: 'Submit for review',
    desc: 'Package the workload for institutional review and track approval state from the submit trail.',
  },
];

const FAQ = [
  {
    q: 'What is Q-Forge?',
    a: 'Q-Forge is the development studio for quantum circuit projects — source/visual editors, local simulation, compile/preflight, and submission packaging.',
  },
  {
    q: 'What is in a project workspace?',
    a: 'Each project is an IDE with Source, Circuit, Simulate, and Submit tabs, plus an activity console, metrics panel, and settings rail.',
  },
  {
    q: 'Do I need a separate account?',
    a: 'Sign in or register with a Q-Forge account. Lab environments may offer a temporary developer continue option.',
  },
  {
    q: 'How do simulation results work?',
    a: 'Runs produce job status, histograms, manifests, and a results drawer with execution metrics adapted from the studio IDE.',
  },
];

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function BuildLandingPage() {
  const heroTileRef = useRef(null);
  const [openFaq, setOpenFaq] = useState(null);
  const onHeroMouseMove = (e) => {
    if (prefersReducedMotion()) return;
    const el = heroTileRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty('--mouse-x', `${x}%`);
    el.style.setProperty('--mouse-y', `${y}%`);
  };

  const onHeroMouseLeave = () => {
    heroTileRef.current?.style.setProperty('--mouse-x', '50%');
    heroTileRef.current?.style.setProperty('--mouse-y', '40%');
  };

  return (
    <CertPublicMarketingShell className="landing-page">
      <section className="landing-hero">
        <CertContainer narrow>
          <div className="landing-hero__float">
            <div
              ref={heroTileRef}
              className="landing-hero__glass-panel"
              onMouseMove={onHeroMouseMove}
              onMouseLeave={onHeroMouseLeave}
            >
              <div className="landing-hero__glass-glow" aria-hidden />
              <h1 className="landing-hero__title landing-hero__title--glass">
                Design, Simulate &amp; Submit
                <br />
                <span className="landing-hero__title-accent">Governed Quantum Workloads</span>
              </h1>
              <p className="landing-hero__lead landing-hero__lead--glass">
                Q-Forge is a modern quantum development studio — OpenQASM source, visual composer, simulation with metrics,
                and compile/preflight packaging in one IDE.
              </p>
              <div className="landing-hero__ctas">
                <Link to="/register" className="qre-btn qre-btn--primary landing-cta-primary">
                  Get Started <ArrowRight size={18} aria-hidden />
                </Link>
                <Link to="/login" className="qre-btn qre-btn--ghost landing-cta-secondary--glass">
                  Sign in to workspace
                </Link>
              </div>
            </div>
          </div>
        </CertContainer>
      </section>

      <section id="capabilities" className="landing-section landing-section--surface">
        <CertContainer>
          <h2 className="landing-section__title">What You Can Do</h2>
          <p className="landing-section__lead">Core Build capabilities from circuit design through governance submission.</p>
          <StudioFeatureGrid items={WHAT_YOU_CAN_DO} />
        </CertContainer>
      </section>

      <section id="features" className="landing-section">
        <CertContainer>
          <h2 className="landing-section__title">Forge tools</h2>
          <p className="landing-section__lead">Practical workspace tools for day-to-day quantum development.</p>
          <StudioFeatureGrid items={PLATFORM_FEATURES} />
        </CertContainer>
      </section>

      <section id="guide" className="landing-section">
        <CertContainer narrow>
          <h2 className="landing-section__title">How It Works</h2>
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
        </CertContainer>
      </section>

      <section id="faq" className="landing-section landing-section--surface">
        <CertContainer narrow className="landing-faq-wrap">
          <h2 className="landing-section__title">Frequently Asked Questions</h2>
          <div className="landing-faq-list">
            {FAQ.map((item, idx) => {
              const open = openFaq === idx;
              return (
                <div key={item.q} className="landing-faq-item">
                  <button
                    type="button"
                    className="landing-faq-item__trigger"
                    onClick={() => setOpenFaq(open ? null : idx)}
                    aria-expanded={open}
                  >
                    {item.q}
                    <ChevronDown size={18} className={`landing-faq-item__chev${open ? ' landing-faq-item__chev--open' : ''}`} />
                  </button>
                  {open ? <div className="landing-faq-item__body">{item.a}</div> : null}
                </div>
              );
            })}
          </div>
        </CertContainer>
      </section>
    </CertPublicMarketingShell>
  );
}
