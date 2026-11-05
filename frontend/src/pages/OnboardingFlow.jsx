import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Check, ChevronDown, ChevronLeft, ChevronUp, Compass, Eye, EyeOff, Key, Loader2,
} from 'lucide-react';
import { api } from '@/services/api';
import {
  ANALYSIS_PHASES,
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
import { OnboardingShell } from '@/components/onboarding/OnboardingChrome';
import '@/components/onboarding/onboarding.css';

const STEPS = ['welcome', 'connect', 'analyze', 'map', 'features'];

const PRIMARY_PROVIDERS = ['ibm_quantum', 'rigetti_quantum', 'ionq_quantum', 'cdac_quantum'];

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
  const isAdmin = currentUser?.role === 'Admin';

  const [step, setStep] = useState('welcome');
  const [maxReachable, setMaxReachable] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [providers, setProviders] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [showSecret, setShowSecret] = useState({});
  const [saveNote, setSaveNote] = useState('');
  const [analysisPhase, setAnalysisPhase] = useState(0);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [discovery, setDiscovery] = useState({
    backends: [],
    capabilities: [],
    summary: null,
    configuredCount: 0,
  });

  const stepIndex = Math.max(0, STEPS.indexOf(step));
  const slide = INTRO_SLIDES[slideIndex];

  useEffect(() => {
    setMaxReachable((m) => Math.max(m, stepIndex));
  }, [stepIndex]);

  const goStep = (next) => {
    if (STEPS.includes(next)) setStep(next);
  };

  useEffect(() => {
    api.getCredentials()
      .then((res) => setProviders((res?.providers || []).filter((p) => PRIMARY_PROVIDERS.includes(p.id))))
      .catch(() => setProviders([]));
  }, []);

  const runAnalysis = useCallback(async () => {
    setAnalysisDone(false);
    setAnalysisPhase(0);
    let phase = 0;
    const tick = setInterval(() => {
      phase += 1;
      setAnalysisPhase(phase);
      if (phase >= ANALYSIS_PHASES.length - 1) clearInterval(tick);
    }, 650);

    const [discoverRes, backends, capRes, summary, creds] = await Promise.all([
      isAdmin ? api.triggerAutoDiscovery().catch(() => null) : Promise.resolve(null),
      api.getBackends().catch(() => []),
      api.getMetricCapabilities().catch(() => ({ providers: [] })),
      api.getSummary().catch(() => null),
      api.getCredentials().catch(() => ({})),
    ]);

    clearInterval(tick);
    setAnalysisPhase(ANALYSIS_PHASES.length);
    const configured = (creds?.providers || []).filter((p) => p.is_configured).length;
    setDiscovery({
      backends: backends || [],
      capabilities: capRes?.providers || [],
      summary: summary,
      configuredCount: configured,
      discoverMessage: discoverRes?.message || discoverRes?.status,
    });
    setAnalysisDone(true);
  }, [isAdmin]);

  useEffect(() => {
    if (step !== 'analyze') return undefined;
    runAnalysis();
    return undefined;
  }, [step, runAnalysis]);

  const saveProvider = async (providerId) => {
    if (!isAdmin) {
      setSaveNote('Only Admin can save provider keys here. Skip to use the lab catalog, or ask an admin to configure integrations.');
      return;
    }
    const draft = drafts[providerId] || { extra: {} };
    const p = providers.find((x) => x.id === providerId);
    try {
      setSaveNote('');
      await api.saveCredentials(providerId, {
        token: draft.token,
        endpoint_url: draft.endpoint_url,
        extra: draft.extra,
      });
      setSaveNote(`${p?.name || providerId} saved — discovery will pick it up in the next step.`);
      const creds = await api.getCredentials();
      setProviders((creds?.providers || []).filter((x) => PRIMARY_PROVIDERS.includes(x.id)));
    } catch (err) {
      setSaveNote(err?.message || 'Could not save credentials.');
    }
  };

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
          left={(
            <span className="onboarding-slide-dots__label">
              Overview {slideIndex + 1} of {INTRO_SLIDES.length}
            </span>
          )}
          right={(
            <>
              {slideIndex > 0 && (
                <button type="button" className="btn btn-secondary" onClick={() => setSlideIndex((i) => i - 1)}>
                  <ChevronLeft size={16} aria-hidden /> Previous
                </button>
              )}
              {slideIndex < INTRO_SLIDES.length - 1 ? (
                <button type="button" className="btn btn-primary" onClick={() => setSlideIndex((i) => i + 1)}>
                  Continue <ArrowRight size={16} aria-hidden />
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => goStep('connect')}>
                  Connect hardware <Key size={16} aria-hidden />
                </button>
              )}
            </>
          )}
        />
      );
    }
    if (step === 'connect') {
      return (
        <WizardFooter
          hint={!isAdmin ? 'Non-admins: skip to demo catalog or ask an admin to save credentials under Configure → Integrations.' : undefined}
          left={(
            <button type="button" className="btn btn-secondary" onClick={() => goStep('welcome')}>
              <ChevronLeft size={16} aria-hidden /> Back
            </button>
          )}
          right={(
            <>
              <button type="button" className="btn btn-secondary" onClick={() => goStep('analyze')}>
                Skip for now
              </button>
              <button type="button" className="btn btn-primary" onClick={() => goStep('analyze')}>
                Run discovery <ArrowRight size={16} aria-hidden />
              </button>
            </>
          )}
        />
      );
    }
    if (step === 'analyze') {
      return (
        <WizardFooter
          hint={analysisDone ? undefined : 'Polling backends, metrics, and fleet summary…'}
          left={(
            <button type="button" className="btn btn-secondary" disabled={!analysisDone} onClick={() => goStep('connect')}>
              <ChevronLeft size={16} aria-hidden /> Back
            </button>
          )}
          right={analysisDone ? (
            <button type="button" className="btn btn-primary" onClick={() => goStep('map')}>
              View data map <ArrowRight size={16} aria-hidden />
            </button>
          ) : (
            <span className="onboarding-footer__status"><Loader2 size={16} className="animate-spin" aria-hidden /> Working…</span>
          )}
        />
      );
    }
    if (step === 'map') {
      return (
        <WizardFooter
          left={(
            <button type="button" className="btn btn-secondary" onClick={() => goStep('analyze')}>
              <ChevronLeft size={16} aria-hidden /> Back
            </button>
          )}
          right={(
            <button type="button" className="btn btn-primary" onClick={() => goStep('features')}>
              Platform features <Compass size={16} aria-hidden />
            </button>
          )}
        />
      );
    }
    if (step === 'features') {
      return (
        <WizardFooter
          hint="Run again from Configure → Integrations → Platform setup."
          left={(
            <button type="button" className="btn btn-secondary" onClick={() => goStep('map')}>
              <ChevronLeft size={16} aria-hidden /> Back
            </button>
          )}
          right={(
            <button type="button" className="btn btn-primary" onClick={finish}>
              Enter console & start tour <ArrowRight size={16} aria-hidden />
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
      step={step}
      stepIndex={stepIndex}
      onStepChange={goStep}
      maxReachableIndex={maxReachable}
      footer={footer}
    >
      <main id="onboarding-main-content" className="onboarding-main" data-qt-scroll tabIndex={-1}>
        <div className="onboarding-shell__inner">
          {step === 'welcome' && (
            <div className="onboarding-welcome-grid">
              <div className="onboarding-card onboarding-card--hero">
                <article key={slide.id} className="onboarding-slide-panel" aria-live="polite">
                  <div className="onboarding-slide-accent" style={{ background: slide.accent }} aria-hidden />
                  <p className="onboarding-intro-badge">{slide.tag}</p>
                  <h1 className="onboarding-slide-title">{slide.title}</h1>
                  <p className="onboarding-slide-body">{slide.body}</p>
                  <ul className="onboarding-bullet-list">
                    {slide.bullets?.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </article>
              </div>
              <aside className="onboarding-intro-rail" aria-label="Choose intro topic">
                {INTRO_SLIDES.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`onboarding-intro-rail__item${i === slideIndex ? ' onboarding-intro-rail__item--active' : ''}`}
                    aria-current={i === slideIndex ? 'true' : undefined}
                    onClick={() => setSlideIndex(i)}
                  >
                    <p className="onboarding-intro-rail__tag">{s.tag}</p>
                    <p className="onboarding-intro-rail__title">{s.title}</p>
                  </button>
                ))}
              </aside>
            </div>
          )}

          {step === 'connect' && (
            <div className="onboarding-layout-split onboarding-layout-split--wide-left">
              <div className="onboarding-card">
                <p className="onboarding-intro-badge">Integrations</p>
                <h2 className="onboarding-slide-title" style={{ fontSize: '1.35rem' }}>Provider credentials</h2>
                <p className="onboarding-slide-body" style={{ maxWidth: 'none' }}>
                  Add cloud or on-prem credentials. Keys stay on the platform — never echoed back in the UI.
                  {!isAdmin && ' Your role can view the catalog; an Admin saves live tokens.'}
                </p>
                {saveNote && (
                  <p className="page-hint" style={{ marginTop: 12 }} role="status">{saveNote}</p>
                )}
                <div className="onboarding-provider-grid" style={{ marginTop: 20 }}>
                  {providers.length === 0 && (
                    <p className="onboarding-empty-note" role="status">
                      Provider list still loading, or the server is unreachable. Skip to use the demo catalog, or add credentials later under Configure → Integrations.
                    </p>
                  )}
                  {providers.map((p) => {
                    const draft = drafts[p.id] || { extra: {} };
                    const vis = showSecret[p.id] || {};
                    const setField = (field, value) => {
                      setDrafts((prev) => {
                        const cur = prev[p.id] || { extra: {} };
                        if (field.in === 'extra') {
                          return { ...prev, [p.id]: { ...cur, extra: { ...(cur.extra || {}), [field.key]: value } } };
                        }
                        return { ...prev, [p.id]: { ...cur, [field.in]: value } };
                      });
                    };
                    const fieldValue = (field) => {
                      const cur = drafts[p.id] || {};
                      if (field.in === 'extra') return (cur.extra || {})[field.key] || p.public_fields?.[field.key] || '';
                      if (field.in === 'endpoint_url') return cur.endpoint_url ?? p.endpoint_url ?? p.public_fields?.endpoint_url ?? '';
                      return cur[field.in] || '';
                    };
                    return (
                      <div key={p.id} className="onboarding-provider-card">
                        <h4>{p.name}</h4>
                        <p>
                          {p.vendor} · {p.modality} · {p.truth_label || p.adapter_status}
                          {p.is_configured ? ' · configured' : ''}
                        </p>
                        {p.fields?.map((field) => (
                          <div key={field.key} style={{ marginBottom: 10 }}>
                            <label className="admin-input-label">{field.label}</label>
                            {field.secret ? (
                              <div className="admin-input-wrapper">
                                <input
                                  type={vis[field.key] ? 'text' : 'password'}
                                  className="input-control admin-input-field"
                                  placeholder={field.label}
                                  value={fieldValue(field)}
                                  onChange={(e) => setField(field, e.target.value)}
                                  autoComplete="off"
                                />
                                <button
                                  type="button"
                                  className="admin-input-toggle-btn"
                                  onClick={() => setShowSecret((s) => ({
                                    ...s,
                                    [p.id]: { ...(s[p.id] || {}), [field.key]: !vis[field.key] },
                                  }))}
                                >
                                  {vis[field.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                              </div>
                            ) : (
                              <input
                                type="text"
                                className="input-control"
                                style={{ width: '100%' }}
                                placeholder={field.label}
                                value={fieldValue(field)}
                                onChange={(e) => setField(field, e.target.value)}
                              />
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={!isAdmin}
                          onClick={() => saveProvider(p.id)}
                        >
                          Save {p.name}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="onboarding-side-panel">
                <p className="onboarding-section-title">Integration steps</p>
                <ul className="onboarding-guide-steps">
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
                <p className="onboarding-section-title" style={{ marginTop: 18 }}>FAQ</p>
                <FaqBlock items={ONBOARDING_FAQ.slice(0, 2)} />
              </div>
            </div>
          )}

          {step === 'analyze' && (
            <div className="onboarding-layout-split">
              <div className="onboarding-card onboarding-analysis">
                <p className="onboarding-intro-badge">Discovery</p>
                <div className="onboarding-analysis__orb" aria-hidden={analysisDone} />
                <div className="onboarding-analysis__phase">
                  {analysisDone
                    ? `Ready — ${discovery.backends.length} backend(s) in catalog`
                    : ANALYSIS_PHASES[Math.min(analysisPhase, ANALYSIS_PHASES.length - 1)]?.label}
                </div>
                <ul className="onboarding-analysis__list">
                  {ANALYSIS_PHASES.map((ph, i) => (
                    <li key={ph.id} data-done={analysisDone || i < analysisPhase}>
                      {analysisDone || i < analysisPhase ? <Check size={14} color="#059669" aria-hidden /> : <Loader2 size={14} className="animate-spin" aria-hidden />}
                      {ph.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="onboarding-side-panel">
                <p className="onboarding-section-title">Discovery snapshot</p>
                <div className="onboarding-discovery-grid">
                  <div className="onboarding-stat-card">
                    <span className="onboarding-stat-card__value">{discovery.backends.length}</span>
                    <span className="onboarding-stat-card__label">Backends</span>
                  </div>
                  <div className="onboarding-stat-card">
                    <span className="onboarding-stat-card__value">{discovery.configuredCount}</span>
                    <span className="onboarding-stat-card__label">Providers configured</span>
                  </div>
                  <div className="onboarding-stat-card">
                    <span className="onboarding-stat-card__value">{liveAdapters}</span>
                    <span className="onboarding-stat-card__label">Live adapters</span>
                  </div>
                  <div className="onboarding-stat-card">
                    <span className="onboarding-stat-card__value">{(discovery.backends || []).filter((b) => b.operational_status === 'ONLINE').length}</span>
                    <span className="onboarding-stat-card__label">ONLINE now</span>
                  </div>
                </div>
                {discovery.discoverMessage && (
                  <p className="onboarding-empty-note" style={{ marginTop: 12 }} role="status">{discovery.discoverMessage}</p>
                )}
                <p className="onboarding-section-title" style={{ marginTop: 16 }}>What happens next</p>
                <p className="onboarding-slide-body" style={{ maxWidth: 'none', fontSize: '13px' }}>
                  The data map step links each signal lane to console routes — telemetry, execution, alerts, and ops — so you know where live data lands.
                </p>
              </div>
            </div>
          )}

          {step === 'map' && (
            <div className="onboarding-card">
              <p className="onboarding-intro-badge">Signal map</p>
              <h2 className="onboarding-slide-title" style={{ fontSize: '1.35rem' }}>Signals and console destinations</h2>
              <p className="onboarding-slide-body" style={{ marginBottom: 16, maxWidth: 'none' }}>
                {discovery.configuredCount} provider slot(s) configured · {discovery.backends.length} backends · {liveAdapters} live adapter(s)
              </p>
              <div className="onboarding-lane-grid">
                {COLLECTION_LANES.map((lane) => (
                  <article key={lane.id} className="onboarding-lane-card">
                    <h4>{lane.label}</h4>
                    <p>{lane.detail}</p>
                    <div>
                      {lane.routes.map((r) => (
                        <Link key={r.path} to={r.path} className="onboarding-map-link">
                          {r.label}
                        </Link>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <details className="onboarding-empty-note" style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Full table view</summary>
                <div className="table-container" style={{ border: 'none', maxHeight: 360, overflow: 'auto', marginTop: 12 }}>
                  <table className="onboarding-map-table">
                    <thead>
                      <tr>
                        <th scope="col">Signal</th>
                        <th scope="col">Sources</th>
                        <th scope="col">Console</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COLLECTION_LANES.map((lane) => (
                        <tr key={lane.id}>
                          <td>
                            <strong>{lane.label}</strong>
                            <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{lane.detail}</div>
                          </td>
                          <td>{lane.providers.join(', ')}</td>
                          <td>
                            {lane.routes.map((r) => (
                              <Link key={r.path} to={r.path} className="onboarding-map-link">
                                {r.label}
                              </Link>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}

          {step === 'features' && (
            <>
              <div className="onboarding-card">
                <p className="onboarding-intro-badge">Console</p>
                <h2 className="onboarding-slide-title" style={{ fontSize: '1.35rem' }}>Primary console routes</h2>
                <p className="onboarding-slide-body" style={{ marginBottom: 18, maxWidth: 'none' }}>
                  Each tile opens a main workspace. Finishing starts a short sidebar tour.
                </p>
                <div className="onboarding-feature-grid">
                  {features.map((f) => (
                    <div key={f.id} className="onboarding-feature-tile">
                      <h4>{f.title}</h4>
                      <p>{f.description}</p>
                      <Link to={f.path} className="onboarding-map-link">{f.path.replace('/app/', '')} →</Link>
                    </div>
                  ))}
                </div>
              </div>
              <div className="onboarding-card" style={{ marginTop: 16 }}>
                <p className="onboarding-section-title">Shift workflow</p>
                <div className="onboarding-workflow-strip">
                  {ONBOARDING_WORKFLOW.map((w) => (
                    <article key={w.n} className="onboarding-workflow-card">
                      <span className="onboarding-workflow-card__n">{w.n}</span>
                      <h4>{w.title}</h4>
                      <p>{w.body}</p>
                    </article>
                  ))}
                </div>
                <p className="onboarding-section-title" style={{ marginTop: 20 }}>Reference</p>
                <FaqBlock items={ONBOARDING_FAQ} defaultOpen={0} />
              </div>
            </>
          )}
        </div>
      </main>
    </OnboardingShell>
  );
}
