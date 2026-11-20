import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ChevronDown, ChevronLeft, ChevronUp, Key, Loader2,
} from 'lucide-react';
import { api } from '@/services/api';
import {
  COLLECTION_LANES,
  CONNECT_GUIDE,
  INTRO_SLIDES,
  ONBOARDING_FAQ,
  ONBOARDING_WORKFLOW,
  PRODUCT_FEATURES,
} from '@/lib/platformCapabilityMap';
import {
  completeOnboarding,
  markConsoleTourPending,
} from '@/lib/onboardingState';
import { isPlatformAdmin } from '@/lib/permissions.js';
import { OnboardingShell, STEP_IDS } from '@/components/onboarding/OnboardingChrome';
import { OnboardingProviderConnect } from '@/components/onboarding/OnboardingProviderConnect';
import '@/components/onboarding/onboarding.css';

const STEPS = STEP_IDS;

function hasVendorKeys(list) {
  return (list || []).some(
    (p) => (p.adapter === 'live' || p.adapter_status === 'LIVE') && p.is_configured,
  );
}

function countConfiguredLive(list) {
  return (list || []).filter(
    (p) => (p.adapter === 'live' || p.adapter_status === 'LIVE') && p.is_configured,
  ).length;
}

function discoveryStatusMessage(poll, discoverRes, backendCount) {
  if (discoverRes?.error) {
    return `Discovery did not complete. ${discoverRes.error}`;
  }
  const n = discoverRes?.total_backends_discovered ?? backendCount ?? 0;
  if (poll) {
    return `Discovery complete. ${n} backend${n === 1 ? '' : 's'} synchronized in the fleet catalog.`;
  }
  return `Fleet catalog ready. ${n} backend${n === 1 ? '' : 's'} available on this server.`;
}

function FaqBlock({ items, defaultOpen = 0 }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="onboarding-faq">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className="onboarding-faq__item">
            <button
              type="button"
              className="onboarding-faq__q"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              <span>{item.q}</span>
              {isOpen ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
            </button>
            {isOpen && <p className="onboarding-faq__a">{item.a}</p>}
          </div>
        );
      })}
    </div>
  );
}

function WizardFooter({ hint, left, right }) {
  return (
    <footer className="onboarding-footer">
      {hint && <p className="onboarding-footer__hint">{hint}</p>}
      <div className="onboarding-footer__inner">
        <div className="onboarding-footer__left">{left}</div>
        <div className="onboarding-footer__right">{right}</div>
      </div>
    </footer>
  );
}

export function OnboardingFlow({ currentUser }) {
  const navigate = useNavigate();
  const username = currentUser?.username;
  const isAdmin = isPlatformAdmin(currentUser) || currentUser?.role === 'QuantumOpsAdmin';

  const [step, setStep] = useState('welcome');
  const [maxReachable, setMaxReachable] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [providers, setProviders] = useState([]);
  const [saveNote, setSaveNote] = useState('');
  const [analysisDone, setAnalysisDone] = useState(false);
  const [pollVendors, setPollVendors] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [discovery, setDiscovery] = useState({
    backends: [],
    capabilities: [],
    summary: null,
    configuredCount: 0,
  });

  const stepIndex = Math.max(0, STEPS.indexOf(step));

  useEffect(() => {
    setMaxReachable((m) => Math.max(m, stepIndex));
  }, [stepIndex]);

  const goStep = (next) => {
    if (STEPS.includes(next)) setStep(next);
  };

  const refreshProviders = useCallback(() => {
    api.getCredentials()
      .then((res) => setProviders(res?.providers || []))
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    refreshProviders();
  }, [refreshProviders]);

  const runAnalysis = useCallback(async () => {
    setAnalysisDone(false);
    setAnalysisBusy(true);
    const poll = pollVendors && isAdmin && hasVendorKeys(providers);
    const [discoverRes, backends, capRes, summary, creds] = await Promise.all([
      poll ? api.triggerAutoDiscovery().catch((e) => ({ error: e.message })) : Promise.resolve(null),
      api.getBackends().catch(() => []),
      api.getMetricCapabilities().catch(() => ({ providers: [] })),
      api.getSummary().catch(() => null),
      api.getCredentials().catch(() => ({})),
    ]);
    const configured = countConfiguredLive(creds?.providers || []);
    setDiscovery({
      backends: backends || [],
      capabilities: capRes?.providers || [],
      summary,
      configuredCount: configured,
      polled: poll,
      discoverMessage: discoveryStatusMessage(poll, discoverRes, (backends || []).length),
    });
    setAnalysisDone(true);
    setAnalysisBusy(false);
  }, [isAdmin, pollVendors, providers]);

  useEffect(() => {
    if (step !== 'analyze') return undefined;
    runAnalysis();
    return undefined;
  }, [step, runAnalysis]);

  const finish = () => {
    completeOnboarding(username);
    markConsoleTourPending(username);
    navigate('/app/overview?startTour=1', { replace: true });
  };

  const skipAll = () => {
    completeOnboarding(username);
    navigate('/app/overview', { replace: true });
  };

  const features = useMemo(
    () => PRODUCT_FEATURES.filter((f) => !f.adminOnly || isAdmin),
    [isAdmin],
  );

  const liveAdapters = discovery.capabilities.filter((c) => c.adapter === 'live').length;

  const footer = (() => {
    if (step === 'welcome') {
      return (
        <WizardFooter
          left={null}
          right={(
            <button type="button" className="btn btn-primary" onClick={() => goStep('connect')}>
              Connect hardware <Key size={16} aria-hidden />
            </button>
          )}
        />
      );
    }
    if (step === 'connect') {
      return (
        <WizardFooter
          hint={!isAdmin ? 'Only Admin can save keys. Skip to use the demo catalog.' : undefined}
          left={(
            <button type="button" className="btn btn-secondary" onClick={() => goStep('welcome')}>
              <ChevronLeft size={16} aria-hidden /> Back
            </button>
          )}
          right={(
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setPollVendors(false); goStep('analyze'); }}
              >
                Skip keys
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setPollVendors(hasVendorKeys(providers)); goStep('analyze'); }}
              >
                {hasVendorKeys(providers) ? 'Discover' : 'Load catalog'} <ArrowRight size={16} aria-hidden />
              </button>
            </>
          )}
        />
      );
    }
    if (step === 'analyze') {
      return (
        <WizardFooter
          hint={analysisBusy ? (pollVendors ? 'Calling configured providers.' : 'Loading catalog.') : undefined}
          left={(
            <button type="button" className="btn btn-secondary" disabled={analysisBusy} onClick={() => goStep('connect')}>
              <ChevronLeft size={16} aria-hidden /> Back
            </button>
          )}
          right={analysisDone ? (
            <button type="button" className="btn btn-primary" onClick={() => goStep('features')}>
              Console routes <ArrowRight size={16} aria-hidden />
            </button>
          ) : (
            <span className="onboarding-footer__status"><Loader2 size={16} className="animate-spin" aria-hidden /> Working</span>
          )}
        />
      );
    }
    if (step === 'features') {
      return (
        <WizardFooter
          left={(
            <button type="button" className="btn btn-secondary" onClick={() => goStep('analyze')}>
              <ChevronLeft size={16} aria-hidden /> Back
            </button>
          )}
          right={(
            <button type="button" className="btn btn-primary" onClick={finish}>
              Open console <ArrowRight size={16} aria-hidden />
            </button>
          )}
        />
      );
    }
    return null;
  })();

  return (
    <OnboardingShell
      currentUser={currentUser}
      onExit={skipAll}
      stepIndex={stepIndex}
      onStepChange={goStep}
      maxReachableIndex={maxReachable}
      footer={footer}
    >
      <main id="onboarding-main-content" className="onboarding-main" data-qt-scroll tabIndex={-1}>
        <div className="onboarding-shell__inner">
          {step === 'welcome' && (
            <div className="onboarding-landing-grid" role="listbox" aria-label="Console areas">
              {INTRO_SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={i === slideIndex}
                  className={`onboarding-landing-card${i === slideIndex ? ' is-active' : ''}`}
                  onClick={() => setSlideIndex(i)}
                >
                  <p className="onboarding-landing-card__tag">{s.tag}</p>
                  <h2 className="onboarding-landing-card__title">{s.title}</h2>
                  <p className="onboarding-landing-card__body">{s.body}</p>
                  <ul className="onboarding-bullet-list">
                    {s.bullets?.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          )}

          {step === 'connect' && (
            <div className="onboarding-connect-layout">
              <div className="onboarding-card onboarding-connect-main">
                <h2 className="onboarding-slide-title onboarding-slide-title--compact">Provider credentials</h2>
                {saveNote ? (
                  <p className="onboarding-inline-notice" role="status">{saveNote}</p>
                ) : null}
                <OnboardingProviderConnect
                  isAdmin={isAdmin}
                  onNotice={(msg) => {
                    setSaveNote(msg);
                    refreshProviders();
                  }}
                />
              </div>
              <aside className="onboarding-side-panel onboarding-connect-rail" aria-label="Integration guide">
                <p className="onboarding-section-title">Integration steps</p>
                <ul className="onboarding-guide-steps onboarding-guide-steps--rail">
                  {CONNECT_GUIDE.map((g) => (
                    <li key={g.n}>
                      <span className="onboarding-guide-steps__num">{g.n}</span>
                      <div>
                        <h4>{g.title}</h4>
                        <p>{g.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="onboarding-section-title onboarding-section-title--spaced">FAQ</p>
                <FaqBlock items={ONBOARDING_FAQ} defaultOpen={0} />
              </aside>
            </div>
          )}

          {step === 'analyze' && (
            <div className="onboarding-card">
              <h2 className="onboarding-slide-title" style={{ fontSize: '1.35rem' }}>Inventory</h2>
              <p className="onboarding-slide-body" style={{ maxWidth: 'none' }}>
                {analysisBusy
                  ? (pollVendors ? 'Refreshing catalog from configured providers.' : 'Loading fleet catalog from this server.')
                  : discovery.discoverMessage}
              </p>
              {analysisBusy ? (
                <div className="onboarding-analysis" style={{ marginTop: 24 }}>
                  <div className="onboarding-analysis__orb" role="status" aria-label="Discovering backends" />
                  <p className="onboarding-footer__status">Working</p>
                </div>
              ) : (
                <div className="table-container" style={{ border: 'none', marginTop: 16, maxHeight: 420, overflow: 'auto' }}>
                  <table className="onboarding-inv-table">
                    <thead>
                      <tr>
                        <th scope="col">Backend</th>
                        <th scope="col">Provider</th>
                        <th scope="col">Qubits</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(discovery.backends || []).length === 0 ? (
                        <tr><td colSpan={4}>No backends in catalog. Save a key under Integrations or keep the demo catalog enabled.</td></tr>
                      ) : discovery.backends.map((b) => (
                        <tr key={b.backend_id || b.backend_name}>
                          <td>{b.backend_name || b.backend_id}</td>
                          <td>{b.provider_id || b.provider || ''}</td>
                          <td>{b.qubit_count ?? b.n_qubits ?? ''}</td>
                          <td>{b.operational_status || b.status || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!analysisBusy && (
                <p className="onboarding-slide-body" style={{ marginTop: 12, fontSize: 13, maxWidth: 'none' }}>
                  Keys saved: {discovery.configuredCount}. Live adapter slots: {liveAdapters}. ONLINE: {(discovery.backends || []).filter((b) => b.operational_status === 'ONLINE').length}.
                </p>
              )}
            </div>
          )}

          {step === 'features' && (
            <>
              <div className="onboarding-card">
                <h2 className="onboarding-slide-title" style={{ fontSize: '1.35rem' }}>Console</h2>
                <p className="onboarding-slide-body" style={{ marginBottom: 16, maxWidth: 'none' }}>
                  Pages you will use after setup. Finish opens overview.
                </p>
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="onboarding-inv-table">
                    <thead>
                      <tr>
                        <th scope="col">Page</th>
                        <th scope="col">Use</th>
                        <th scope="col">Path</th>
                      </tr>
                    </thead>
                    <tbody>
                      {features.map((f) => (
                        <tr key={f.id}>
                          <td>{f.title}</td>
                          <td>{f.description}</td>
                          <td><Link to={f.path}>{f.path.replace('/app/', '')}</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-container" style={{ border: 'none', marginTop: 20 }}>
                  <table className="onboarding-inv-table">
                    <thead>
                      <tr>
                        <th scope="col">Metric family</th>
                        <th scope="col">Opens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COLLECTION_LANES.map((lane) => (
                        <tr key={lane.id}>
                          <td>{lane.label}</td>
                          <td>{lane.routes.map((r) => r.label).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="onboarding-card" style={{ marginTop: 16 }}>
                <p className="onboarding-section-title">Order of work</p>
                <div className="onboarding-workflow-strip">
                  {ONBOARDING_WORKFLOW.map((w) => (
                    <article key={w.n} className="onboarding-workflow-card">
                      <span className="onboarding-workflow-card__n">{w.n}</span>
                      <h4>{w.title}</h4>
                      <p>{w.body}</p>
                    </article>
                  ))}
                </div>
                <FaqBlock items={ONBOARDING_FAQ} defaultOpen={-1} />
              </div>
            </>
          )}
        </div>
      </main>
    </OnboardingShell>
  );
}
