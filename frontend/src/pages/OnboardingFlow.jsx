import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ChevronDown, ChevronLeft, ChevronUp, Eye, EyeOff, Key, Loader2,
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
import { OnboardingShell, STEP_IDS } from '@/components/onboarding/OnboardingChrome';
import '@/components/onboarding/onboarding.css';

const STEPS = STEP_IDS;
const KEY_PROVIDERS = new Set(['ibm_quantum', 'ionq_quantum', 'cdac_quantum']);

function hasVendorKeys(list) {
  return (list || []).some((p) => KEY_PROVIDERS.has(p.id) && p.is_configured);
}

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

  useEffect(() => {
    api.getCredentials()
      .then((res) => setProviders((res?.providers || []).filter((p) => PRIMARY_PROVIDERS.includes(p.id))))
      .catch(() => setProviders([]));
  }, []);

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
    const configured = (creds?.providers || []).filter((p) => KEY_PROVIDERS.has(p.id) && p.is_configured).length;
    setDiscovery({
      backends: backends || [],
      capabilities: capRes?.providers || [],
      summary,
      configuredCount: configured,
      polled: poll,
      discoverMessage: discoverRes?.error
        ? String(discoverRes.error)
        : (poll ? `Vendor poll finished. ${discoverRes?.total_backends_discovered ?? (backends || []).length} backend(s).` : 'No IBM / IonQ / on-prem keys saved. Showing the catalog already on this server.'),
    });
    setAnalysisDone(true);
    setAnalysisBusy(false);
  }, [isAdmin, pollVendors, providers]);

  useEffect(() => {
    if (step !== 'analyze') return undefined;
    runAnalysis();
    return undefined;
  }, [step, runAnalysis]);

  const saveProvider = async (providerId) => {
    if (!isAdmin) {
      setSaveNote('Only Admin can save provider keys. Skip to use the lab catalog.');
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
      setSaveNote(`${p?.name || providerId} saved. Discovery runs in the next step.`);
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
            <div className="onboarding-layout-split onboarding-layout-split--wide-left">
              <div className="onboarding-card">
                <p className="onboarding-intro-badge">Integrations</p>
                <h2 className="onboarding-slide-title" style={{ fontSize: '1.35rem' }}>Provider credentials</h2>
                <p className="onboarding-slide-body" style={{ maxWidth: 'none' }}>
                  Add cloud or on-prem credentials. Keys stay on the server and are not shown again.
                  {!isAdmin && ' Your role can view the catalog; an Admin saves live tokens.'}
                </p>
                {saveNote && (
                  <p className="page-hint" style={{ marginTop: 12 }} role="status">{saveNote}</p>
                )}
                <div className="onboarding-provider-grid" style={{ marginTop: 20 }}>
                  {providers.length === 0 && (
                    <p className="onboarding-empty-note" role="status">
                      Provider list still loading, or the server is unreachable. Skip to use the demo catalog.
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
            <div className="onboarding-card">
              <h2 className="onboarding-slide-title" style={{ fontSize: '1.35rem' }}>Inventory</h2>
              <p className="onboarding-slide-body" style={{ maxWidth: 'none' }}>
                {analysisBusy
                  ? (pollVendors ? 'Calling IBM, IonQ, or the lab controller you configured.' : 'Reading backends already stored on this server.')
                  : discovery.discoverMessage}
              </p>
              {analysisBusy ? (
                <p className="onboarding-footer__status" style={{ marginTop: 16 }}>
                  <Loader2 size={16} className="animate-spin" aria-hidden /> Working
                </p>
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
