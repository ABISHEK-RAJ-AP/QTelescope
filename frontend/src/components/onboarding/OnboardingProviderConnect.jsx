import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, X } from 'lucide-react';
import { api } from '@/services/api';
import { Field, fieldClass } from '@/components/AuthShell';

function isLiveAdapter(p) {
  return p?.adapter === 'live' || p?.adapter_status === 'LIVE';
}

function providerStatus(p, verBy) {
  const live = isLiveAdapter(p);
  if (!live) return { key: 'catalog', label: 'Catalog entry', action: 'View details' };
  const v = verBy[p.id];
  if (p.is_configured && v?.verified) {
    return { key: 'verified', label: 'Verified', action: 'Manage' };
  }
  if (p.is_configured) {
    return { key: 'configured', label: 'Credentials saved', action: 'Manage' };
  }
  return { key: 'idle', label: 'Not configured', action: 'Configure' };
}

function useModalA11y(onClose) {
  const panelRef = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const panel = panelRef.current;
    panel?.querySelector('button, [href], input, select, textarea')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [onClose]);
  return panelRef;
}

function CatalogInfoModal({ provider, onClose }) {
  const panelRef = useModalA11y(onClose);
  if (!provider) return null;
  return (
    <div className="ob-provider-modal" role="presentation">
      <button type="button" className="ob-provider-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div
        ref={panelRef}
        className="ob-provider-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ob-provider-modal-title"
      >
        <header className="ob-provider-modal__head">
          <div>
            <h3 id="ob-provider-modal-title">{provider.name}</h3>
            <p className="ob-provider-modal__meta">
              {provider.vendor} · {(provider.modality || '').replace(/_/g, ' ')}
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-icon-only" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="ob-provider-modal__availability">
          <span className="badge badge-info">Catalog only</span>
        </div>
        <p className="ob-provider-modal__intro">
          {provider.name} is listed in the Q-TeleScope provider catalog. Direct credential configuration
          is not available for this integration in the current build.
        </p>
        <p className="ob-provider-modal__intro ob-provider-modal__intro--muted">
          Continue setup with a supported live adapter, or review catalog entries later under
          Administration → Integrations.
        </p>
        <footer className="ob-provider-modal__foot">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

function CredentialModal({
  provider,
  isAdmin,
  onClose,
  onSaved,
}) {
  const [drafts, setDrafts] = useState({ extra: {} });
  const [showSecret, setShowSecret] = useState({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const panelRef = useModalA11y(onClose);

  if (!provider) return null;
  if (!isLiveAdapter(provider)) {
    return <CatalogInfoModal provider={provider} onClose={onClose} />;
  }

  const fieldValue = (field) => {
    if (field.in === 'extra') return (drafts.extra || {})[field.key] ?? provider.public_fields?.[field.key] ?? '';
    if (field.in === 'endpoint_url') {
      return drafts.endpoint_url ?? provider.endpoint_url ?? provider.public_fields?.endpoint_url ?? '';
    }
    return drafts[field.in] ?? '';
  };

  const setField = (field, value) => {
    setDrafts((prev) => {
      if (field.in === 'extra') {
        return { ...prev, extra: { ...(prev.extra || {}), [field.key]: value } };
      }
      return { ...prev, [field.in]: value };
    });
  };

  const saveAndVerify = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      setFeedback({ type: 'info', text: 'An administrator must save provider credentials.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const token = String(drafts.token || '').trim();
      const needsToken = (provider.fields || []).some(
        (f) => f.in === 'token' && f.required !== false,
      );
      if (needsToken && !token && !provider.is_configured) {
        setFeedback({ type: 'error', text: 'API key is required for this provider.' });
        setBusy(false);
        return;
      }
      const saveRes = await api.saveCredentials(provider.id, {
        token: token || undefined,
        endpoint_url: drafts.endpoint_url || provider.endpoint_url || undefined,
        extra: drafts.extra,
      });
      const ver = await api.getAdapterVerification().catch(() => ({ results: [] }));
      const row = (ver?.results || []).find((r) => r.provider_id === provider.id);
      const verified = row?.verified === true;
      const discovered = saveRes?.discovered ?? saveRes?.backend_ids?.length ?? 0;
      const detail = saveRes?.message || '';
      setFeedback({
        type: verified || discovered > 0 ? 'success' : 'warn',
        text: detail
          || (verified
            ? 'Credentials saved and adapter verified.'
            : 'Credentials saved. Run verification from Administration → Integrations if the adapter did not respond.'),
      });
      onSaved({ verified, verification: ver?.results || [], saveRes });
      if (verified || discovered > 0) {
        window.setTimeout(onClose, 900);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err?.message || 'Could not save credentials.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ob-provider-modal" role="presentation">
      <button type="button" className="ob-provider-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div
        ref={panelRef}
        className="ob-provider-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ob-provider-modal-title"
      >
        <header className="ob-provider-modal__head">
          <div>
            <h3 id="ob-provider-modal-title">Connect {provider.name}</h3>
            <p className="ob-provider-modal__meta">
              {provider.vendor} · {(provider.modality || '').replace(/_/g, ' ')}
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-icon-only" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <p className="ob-provider-modal__intro">
          Configure credentials to enable backend discovery and telemetry collection for this provider.
        </p>
        <p className="ob-provider-modal__intro ob-provider-modal__intro--muted">
          Saved secrets are not shown again in this UI. Leave secret fields blank to keep values already stored on the server.
        </p>
        <form className="ob-provider-modal__form" onSubmit={saveAndVerify}>
          {(provider.fields || []).map((field) => {
            const inputId = `ob-prov-${provider.id}-${field.key}`;
            if (field.secret) {
              const visible = !!showSecret[field.key];
              return (
                <Field key={field.key} label={field.label} forId={inputId}>
                  <div className="onboarding-secret-field">
                    <input
                      id={inputId}
                      name={field.key}
                      type={visible ? 'text' : 'password'}
                      className={`${fieldClass} onboarding-secret-field__input`}
                      value={fieldValue(field)}
                      onChange={(ev) => setField(field, ev.target.value)}
                      autoComplete="new-password"
                      placeholder={provider.is_configured ? 'Leave blank to keep existing secret' : ''}
                    />
                    <button
                      type="button"
                      className="onboarding-secret-field__toggle"
                      onClick={() => setShowSecret((s) => ({ ...s, [field.key]: !visible }))}
                      aria-label={visible ? 'Hide' : 'Show'}
                    >
                      {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                    </button>
                  </div>
                </Field>
              );
            }
            return (
              <Field key={field.key} label={field.label} forId={inputId}>
                <input
                  id={inputId}
                  name={field.key}
                  type={field.in === 'endpoint_url' ? 'url' : 'text'}
                  className={fieldClass}
                  value={fieldValue(field)}
                  onChange={(ev) => setField(field, ev.target.value)}
                  autoComplete={field.in === 'endpoint_url' ? 'url' : 'off'}
                />
              </Field>
            );
          })}
          {feedback ? (
            <p
              className={`ob-provider-modal__feedback ob-provider-modal__feedback--${feedback.type}`}
              role="status"
            >
              {feedback.text}
            </p>
          ) : null}
          <footer className="ob-provider-modal__foot">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !isAdmin}>
              {busy ? <><Loader2 size={16} className="animate-spin" aria-hidden /> Saving…</> : 'Save credentials'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function ProviderTile({ p, verBy, onOpen }) {
  const st = providerStatus(p, verBy);
  const icon = st.key === 'verified'
    ? <CheckCircle2 size={18} className="ob-provider-tile__icon ob-provider-tile__icon--ok" aria-hidden />
    : st.key === 'configured'
      ? <KeyRound size={18} className="ob-provider-tile__icon" aria-hidden />
      : null;
  return (
    <button
      type="button"
      role="listitem"
      className={`ob-provider-tile ob-provider-tile--${st.key}`}
      onClick={() => onOpen(p.id)}
    >
      <span className="ob-provider-tile__row">
        {icon}
        <span className="ob-provider-tile__title">{p.name}</span>
      </span>
      <span className="ob-provider-tile__hint">
        {p.vendor} · {(p.modality || '').replace(/_/g, ' ')}
      </span>
      <span className="ob-provider-tile__foot">
        <span className={`ob-provider-tile__status ob-provider-tile__status--${st.key}`}>{st.label}</span>
        <span className="ob-provider-tile__action">{st.action}</span>
      </span>
    </button>
  );
}

export function OnboardingProviderConnect({ isAdmin, onNotice }) {
  const [providers, setProviders] = useState([]);
  const [verification, setVerification] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalId, setModalId] = useState(null);
  const [query, setQuery] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [creds, ver] = await Promise.all([
        api.getCredentials(),
        api.getAdapterVerification().catch(() => ({ results: [] })),
      ]);
      const list = (creds?.providers || []).toSorted((a, b) => {
        const an = (a.name || a.id || '').toLowerCase();
        const bn = (b.name || b.id || '').toLowerCase();
        return an.localeCompare(bn);
      });
      setProviders(list);
      setVerification(ver?.results || []);
    } catch {
      setProviders([]);
      setVerification([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const verBy = useMemo(
    () => Object.fromEntries(verification.map((v) => [v.provider_id, v])),
    [verification],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) => {
      const hay = `${p.name || ''} ${p.vendor || ''} ${p.modality || ''} ${p.id || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [providers, query]);

  const { integrations, catalog } = useMemo(() => {
    const integrationsList = [];
    const catalogList = [];
    filtered.forEach((p) => {
      if (isLiveAdapter(p)) integrationsList.push(p);
      else catalogList.push(p);
    });
    return { integrations: integrationsList, catalog: catalogList };
  }, [filtered]);

  const modalProvider = providers.find((p) => p.id === modalId) || null;

  return (
    <>
      <p className="onboarding-slide-body onboarding-slide-body--wide">
        Choose a supported provider to configure access. Catalog entries show what is tracked but may not
        accept credentials here. You can add more integrations later under Administration → Integrations.
        {!isAdmin ? ' Only administrators can save live credentials; you may browse and continue with the demo catalog.' : null}
      </p>

      {!loading && providers.length > 3 && (
        <label className="onboarding-provider-search">
          <span className="sr-only">Search providers</span>
          <input
            type="search"
            className="input-control"
            placeholder="Search providers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search providers"
          />
        </label>
      )}

      {loading ? (
        <p className="onboarding-empty-note" role="status">Loading provider catalog…</p>
      ) : filtered.length === 0 ? (
        <p className="onboarding-empty-note" role="status">
          No providers match your search. Clear the filter or skip this step to use the demo catalog.
        </p>
      ) : (
        <>
          {integrations.length > 0 && (
            <>
              <h3 className="onboarding-section-title onboarding-section-title--spaced-sm">Available integrations</h3>
              <div className="ob-provider-grid ob-provider-grid--tiles" role="list" aria-label="Configurable integrations">
                {integrations.map((p) => (
                  <ProviderTile key={p.id} p={p} verBy={verBy} onOpen={setModalId} />
                ))}
              </div>
            </>
          )}
          {catalog.length > 0 && (
            <>
              <h3 className="onboarding-section-title onboarding-section-title--spaced">Additional catalog</h3>
              <p className="onboarding-slide-body" style={{ maxWidth: '62ch', fontSize: '0.875rem', marginBottom: 12 }}>
                Listed for reference. Open a card to see integration availability — no credential form unless a live adapter exists.
              </p>
              <div className="ob-provider-grid ob-provider-grid--tiles ob-provider-grid--catalog" role="list" aria-label="Catalog providers">
                {catalog.map((p) => (
                  <ProviderTile key={p.id} p={p} verBy={verBy} onOpen={setModalId} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {modalId && (
        <CredentialModal
          provider={modalProvider}
          isAdmin={isAdmin}
          onClose={() => setModalId(null)}
          onSaved={({ verified, verification: ver }) => {
            setVerification(ver);
            reload();
            onNotice?.(verified ? `${modalProvider?.name} verified.` : `${modalProvider?.name} saved.`);
          }}
        />
      )}
    </>
  );
}

export default OnboardingProviderConnect;