import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ChevronLeft, LayoutDashboard, Loader2, Radio, Server, Shield,
} from 'lucide-react';
import { api } from '@/services/api';
import { PRODUCT_FEATURES } from '@/lib/platformCapabilityMap';
import {
  completeOnboarding,
  markConsoleTourPending,
} from '@/lib/onboardingState';
import { isPlatformAdmin } from '@/lib/permissions.js';
import { formatBackendTitle, formatLineageFilterLabel, formatProviderLabel } from '@/lib/displayLabels.js';
import { notifySuccess } from '@/lib/toast.js';
import { OnboardingShell, STEP_IDS } from '@/components/onboarding/OnboardingChrome';
import { OnboardingConnectivityIllustration } from '@/components/onboarding/OnboardingConnectivityIllustration';
import { OnboardingProviderConnect } from '@/components/onboarding/OnboardingProviderConnect';
import { lineageOf, useProviderLineage } from '@/pages/backendUtils.js';
import '@/components/onboarding/onboarding.css';

const STEPS = STEP_IDS;

const WELCOME_CAPABILITIES = [
  {
    title: 'Fleet visibility',
    body: 'Unified hardware inventory, health vectors, and backend status across providers.',
  },
  {
    title: 'Live telemetry',
    body: 'Calibration freshness, coherence metrics, and operational signals with provenance.',
  },
  {
    title: 'Operational control',
    body: 'Alerts, incidents, evidence exports, and platform health for your shift.',
  },
];

const DISCOVERY_STAGES = [
  { id: 'config', label: 'Load provider configuration' },
  { id: 'contact', label: 'Contact configured providers' },
  { id: 'sync', label: 'Synchronize backend inventory' },
  { id: 'validate', label: 'Validate resource availability' },
];

const LAUNCH_DESTINATIONS = [
  { title: 'Fleet overview', body: 'Monitor infrastructure health and fleet KPIs.', path: '/app/overview', icon: LayoutDashboard },
  { title: 'Live telemetry', body: 'Explore quantum metrics and calibration age.', path: '/app/telemetry/live', icon: Radio },
  { title: 'Backend inventory', body: 'View discovered backends and qubit counts.', path: '/app/backends/inventory', icon: Server },
  { title: 'Operator console', body: 'Triage alerts, incidents, and collector status.', path: '/app/operate', icon: Shield },
];

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

function countVerifiedLive(list, verification) {
  const verBy = Object.fromEntries((verification || []).map((v) => [v.provider_id, v]));
  return (list || []).filter((p) => {
    const live = p.adapter === 'live' || p.adapter_status === 'LIVE';
    return live && p.is_configured && verBy[p.id]?.verified;
  }).length;
}

function discoveryStatusMessage(poll, discoverRes, backendCount) {
  if (discoverRes?.error) {
    return `Discovery did not complete. ${discoverRes.error}`;
  }
  const n = discoverRes?.total_backends_discovered ?? backendCount ?? 0;
  if (poll) {
    return `Discovery complete — ${n} backend${n === 1 ? '' : 's'} synchronized in the fleet catalog.`;
  }
  return `Fleet catalog ready — ${n} backend${n === 1 ? '' : 's'} on this server (includes demo or seeded entries when no live poll ran).`;
}

function backendStatusBadge(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'ONLINE' || s === 'AVAILABLE') return 'badge-healthy';
  if (s === 'OFFLINE' || s === 'UNAVAILABLE') return 'badge-offline';
  return 'badge-info';
}

const STAGE_STATE_LABEL = {
  done: 'Completed',
  active: 'In progress',
  pending: 'Pending',
  skipped: 'Skipped',
  error: 'Failed',
};

function discoveryStageClass(state) {
  if (state === 'done') return ' is-done';
  if (state === 'active') return ' is-active';
  if (state === 'error') return ' is-error';
  if (state === 'skipped') return ' is-skipped';
  return '';
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
  const [providers, setProviders] = useState([]);
  const [verification, setVerification] = useState([]);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [pollVendors, setPollVendors] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState({});
  const lineage = useProviderLineage();
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
    Promise.all([
      api.getCredentials().catch(() => ({ providers: [] })),
      api.getAdapterVerification().catch(() => ({ results: [] })),
    ]).then(([creds, ver]) => {
      setProviders(creds?.providers || []);
      setVerification(ver?.results || []);
    });
  }, []);

  useEffect(() => {
    refreshProviders();
  }, [refreshProviders]);

  const runAnalysis = useCallback(async () => {
    setAnalysisDone(false);
    setAnalysisBusy(true);
    const poll = pollVendors && isAdmin && hasVendorKeys(providers);
    setDiscoveryProgress({
      config: 'active',
      contact: poll ? 'pending' : 'skipped',
      sync: 'pending',
      validate: 'pending',
    });

    let discoverRes = null;
    let backends = [];
    let capRes = { providers: [] };
    let summary = null;
    let verResults = [];
    let configured = 0;

    try {
      const [creds, ver] = await Promise.all([
        api.getCredentials().catch(() => ({ providers: [] })),
        api.getAdapterVerification().catch(() => ({ results: [] })),
      ]);
      configured = countConfiguredLive(creds?.providers || []);
      verResults = ver?.results || [];
      setProviders(creds?.providers || []);
      setVerification(verResults);
      setDiscoveryProgress((p) => ({
        ...p,
        config: 'done',
        contact: poll ? 'active' : 'skipped',
        sync: poll ? 'pending' : 'active',
      }));

      if (poll) {
        discoverRes = await api.triggerAutoDiscovery().catch((e) => ({ error: e.message }));
        setDiscoveryProgress((p) => ({
          ...p,
          contact: discoverRes?.error ? 'error' : 'done',
          sync: 'active',
        }));
      }

      const [backendsRes, cap, sum, ver2] = await Promise.all([
        api.getBackends().catch(() => []),
        api.getMetricCapabilities().catch(() => ({ providers: [] })),
        api.getSummary().catch(() => null),
        api.getAdapterVerification().catch(() => ({ results: verResults })),
      ]);
      backends = backendsRes || [];
      capRes = cap;
      summary = sum;
      verResults = ver2?.results || verResults;
      setVerification(verResults);
      setDiscoveryProgress((p) => ({ ...p, sync: 'done', validate: 'active' }));

      setDiscovery({
        backends,
        capabilities: capRes?.providers || [],
        summary,
        configuredCount: configured,
        polled: poll,
        discoverMessage: discoveryStatusMessage(poll, discoverRes, backends.length),
        discoverError: discoverRes?.error,
      });
      setDiscoveryProgress((p) => ({ ...p, validate: 'done' }));
      setAnalysisDone(true);
    } finally {
      setAnalysisBusy(false);
    }
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

  const verifiedProviders = countVerifiedLive(providers, verification);
  const onlineCount = (discovery.backends || []).filter(
    (b) => String(b.operational_status || b.status || '').toUpperCase() === 'ONLINE',
  ).length;

  const footer = (() => {
    if (step === 'welcome') {
      return (
        <WizardFooter
          left={null}
          right={(
            <button type="button" className="btn btn-primary" onClick={() => goStep('connect')}>
              Get started <ArrowRight size={16} aria-hidden />
            </button>
          )}
        />
      );
    }
    if (step === 'connect') {
      return (
        <WizardFooter
          hint={!isAdmin ? 'Only administrators save credentials. Skip to continue with the demo catalog.' : undefined}
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
                Skip for now
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setPollVendors(hasVendorKeys(providers)); goStep('analyze'); }}
              >
                Discover resources <ArrowRight size={16} aria-hidden />
              </button>
            </>
          )}
        />
      );
    }
    if (step === 'analyze') {
      return (
        <WizardFooter
          hint={analysisBusy ? (pollVendors ? 'Contacting configured providers and refreshing inventory.' : 'Loading fleet catalog from this server.') : undefined}
          left={(
            <button type="button" className="btn btn-secondary" disabled={analysisBusy} onClick={() => goStep('connect')}>
              <ChevronLeft size={16} aria-hidden /> Back
            </button>
          )}
          right={analysisDone ? (
            <button type="button" className="btn btn-primary" onClick={() => goStep('features')}>
              Continue <ArrowRight size={16} aria-hidden />
            </button>
          ) : (
            <span className="onboarding-footer__status" aria-live="polite">
              <Loader2 size={16} className="animate-spin" aria-hidden /> Discovering…
            </span>
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
              Launch Q-TeleScope <ArrowRight size={16} aria-hidden />
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
        <div className="onboarding-shell__inner onboarding-shell__inner--step">
          {step === 'welcome' && (
            <div className="onboarding-hero onboarding-hero--split onboarding-slide-panel">
              <div className="onboarding-hero__copy">
                <p className="onboarding-hero__eyebrow">Quantum infrastructure management</p>
                <h1 className="onboarding-hero__title">Your quantum infrastructure. One unified view.</h1>
                <p className="onboarding-hero__lead">
                  Connect, discover, monitor, and manage quantum computing resources across providers
                  from a single operational platform.
                </p>
                <ul className="onboarding-hero__bullets">
                  <li>Connect quantum providers and on-premises simulators</li>
                  <li>Discover hardware inventory with explicit data provenance</li>
                  <li>Monitor telemetry, health, alerts, and evidence exports</li>
                </ul>
              </div>
              <div className="onboarding-hero__visual">
                <OnboardingConnectivityIllustration />
              </div>
              <div className="onboarding-cap-grid onboarding-hero__caps">
                {WELCOME_CAPABILITIES.map((c) => (
                  <article key={c.title} className="onboarding-cap-card">
                    <h2 className="onboarding-cap-card__title">{c.title}</h2>
                    <p className="onboarding-cap-card__body">{c.body}</p>
                  </article>
                ))}
              </div>
              <p className="onboarding-hero__note">
                This setup takes a few minutes. You can revisit Administration → Integrations anytime.
              </p>
            </div>
          )}

          {step === 'connect' && (
            <div className="onboarding-card onboarding-connect-panel onboarding-slide-panel">
              <h2 className="onboarding-slide-title">Connect your quantum resources</h2>
              <OnboardingProviderConnect
                isAdmin={isAdmin}
                onNotice={(msg) => {
                  notifySuccess(msg);
                  refreshProviders();
                }}
              />
            </div>
          )}

          {step === 'analyze' && (
            <div className="onboarding-card onboarding-discover-panel onboarding-slide-panel">
              <h2 className="onboarding-slide-title">Discover quantum resources</h2>
              <p className="onboarding-slide-body" style={{ maxWidth: '62ch' }}>
                {analysisBusy
                  ? (pollVendors
                    ? 'Retrieving backend inventory from configured live adapters.'
                    : 'Loading fleet catalog from this server without a live provider poll.')
                  : discovery.discoverMessage}
              </p>

              {analysisBusy ? (
                <div className="onboarding-discover-progress" role="status" aria-live="polite">
                  <div className="onboarding-discover-progress__head">
                    <Loader2 size={20} className="animate-spin" aria-hidden />
                    <span>Discovering resources</span>
                  </div>
                  <ol className="onboarding-discover-stages">
                    {DISCOVERY_STAGES.map((stage) => {
                      const state = discoveryProgress[stage.id] || 'pending';
                      return (
                        <li
                          key={stage.id}
                          className={`onboarding-discover-stages__item${discoveryStageClass(state)}`}
                        >
                          <span className="onboarding-discover-stages__label">{stage.label}</span>
                          <span className="onboarding-discover-stages__state">
                            {STAGE_STATE_LABEL[state] || STAGE_STATE_LABEL.pending}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  <div className="onboarding-inv-skeleton" aria-hidden>
                    <div className="onboarding-inv-skeleton__row" />
                    <div className="onboarding-inv-skeleton__row" />
                    <div className="onboarding-inv-skeleton__row" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="onboarding-stat-grid onboarding-stat-grid--discover">
                    <OnboardingStat value={discovery.backends?.length ?? 0} label="Backends discovered" />
                    <OnboardingStat value={onlineCount} label="Reported online" />
                    <OnboardingStat value={discovery.configuredCount ?? 0} label="Saved credentials" />
                    <OnboardingStat value={verifiedProviders} label="Verified adapters" />
                  </div>
                  {discovery.discoverError ? (
                    <p className="onboarding-provenance-note onboarding-provenance-note--error" role="alert">
                      Live discovery reported an error: {discovery.discoverError}. The table below reflects the
                      last catalog on this server.
                    </p>
                  ) : null}
                  {!pollVendors && (discovery.backends?.length ?? 0) > 0 && (
                    <p className="onboarding-provenance-note" role="note">
                      Catalog loaded without a live provider poll. Rows may include demo or seeded backends —
                      check the Source column and Platform health before treating counts as live hardware.
                    </p>
                  )}
                  {!pollVendors && onlineCount > Math.max(verifiedProviders, discovery.configuredCount || 0, 1) && (
                    <p className="onboarding-provenance-note" role="note">
                      More online backends than verified live adapters usually means demo catalog or shared seeded
                      inventory — not necessarily one live credential per backend.
                    </p>
                  )}
                  <div className="onboarding-table-shell">
                    <table className="onboarding-inv-table">
                      <thead>
                        <tr>
                          <th scope="col">Backend</th>
                          <th scope="col">Provider</th>
                          <th scope="col">Qubits</th>
                          <th scope="col">Source</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(discovery.backends || []).length === 0 ? (
                          <tr>
                            <td colSpan={5}>
                              No backends in catalog. Save credentials on Connect, or keep the demo catalog enabled.
                            </td>
                          </tr>
                        ) : discovery.backends.map((b) => {
                          const src = lineageOf(lineage.map, b.provider_id || b.provider);
                          return (
                            <tr key={b.backend_id || b.backend_name}>
                              <td>{formatBackendTitle(b)}</td>
                              <td>{formatProviderLabel(b.provider_id || b.provider, b.provider_name)}</td>
                              <td>{b.qubit_count ?? b.n_qubits ?? '—'}</td>
                              <td>
                                <span className="onboarding-inv-source">
                                  {formatLineageFilterLabel(src)}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${backendStatusBadge(b.operational_status || b.status)}`}>
                                  {b.operational_status || b.status || '—'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'features' && (
            <div className="onboarding-complete onboarding-slide-panel">
              <div className="onboarding-card onboarding-complete__intro">
                <p className="onboarding-hero__eyebrow">Setup complete</p>
                <h2 className="onboarding-slide-title" style={{ marginBottom: 8 }}>Your workspace is ready</h2>
                <p className="onboarding-slide-body" style={{ maxWidth: '62ch' }}>
                  Review discovered resources and open the console. You can manage integrations under
                  {' '}<Link to="/app/admin/integrations" className="fs-link">Administration → Integrations</Link>.
                </p>
                <div className="onboarding-stat-grid" style={{ marginTop: 20 }}>
                  <OnboardingStat value={verifiedProviders} label="Verified provider" />
                  <OnboardingStat value={discovery.backends?.length ?? 0} label="Discovered backends" />
                  <OnboardingStat value={onlineCount} label="Reported online" />
                </div>
              </div>

              <h3 className="onboarding-section-title onboarding-section-title--spaced">Explore your workspace</h3>
              <div className="onboarding-launch-grid">
                {LAUNCH_DESTINATIONS.filter((d) => d.path !== '/app/admin' || isAdmin).map((d) => {
                  const Icon = d.icon;
                  return (
                    <Link key={d.path} to={d.path} className="onboarding-launch-card">
                      <Icon size={20} className="onboarding-launch-card__icon" aria-hidden />
                      <span className="onboarding-launch-card__title">{d.title}</span>
                      <span className="onboarding-launch-card__body">{d.body}</span>
                    </Link>
                  );
                })}
              </div>

              {isAdmin && (
                <details className="onboarding-more-routes">
                  <summary>All console areas ({features.length})</summary>
                  <ul className="onboarding-more-routes__list">
                    {features.map((f) => (
                      <li key={f.id}>
                        <Link to={f.path}>{f.title}</Link>
                        <span>{f.description}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </main>
    </OnboardingShell>
  );
}

function OnboardingStat({ value, label }) {
  return (
    <div className="onboarding-stat-card">
      <span className="onboarding-stat-card__value">{value}</span>
      <span className="onboarding-stat-card__label">{label}</span>
    </div>
  );
}