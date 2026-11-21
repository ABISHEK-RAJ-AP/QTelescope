import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Eye, EyeOff, KeyRound, Loader2, X } from 'lucide-react';
import { api } from '@/services/api';
import { Field, fieldClass } from '@/components/AuthShell';

function providerStatus(p, verBy) {
  const live = p.adapter === 'live' || p.adapter_status === 'LIVE';
  if (!live) return { key: 'catalog', label: 'Catalog only' };
  const v = verBy[p.id];
  if (p.is_configured && v?.verified) {
    return { key: 'verified', label: 'Verified' };
  }
  if (p.is_configured) {
    return { key: 'configured', label: 'Credentials saved' };
  }
  return { key: 'idle', label: 'Not configured' };
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

  if (!provider) return null;

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
            : 'Credentials saved. Run verification from Configure → Integrations if the adapter did not respond.'),
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
        <p className="ob-provider-modal__intro">
          Credentials are stored on the platform server over HTTPS. Saved secrets are not shown again in this UI.
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
              {busy ? <><Loader2 size={16} className="animate-spin" aria-hidden /> Saving…</> : 'Save and verify'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export function OnboardingProviderConnect({ isAdmin, onNotice }) {
  const [providers, setProviders] = useState([]);
  const [verification, setVerification] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalId, setModalId] = useState(null);

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

  const sortedProviders = useMemo(() => {
    const isLive = (p) => p.adapter === 'live' || p.adapter_status === 'LIVE';
    return providers.toSorted((a, b) => {
      const d = Number(isLive(a)) - Number(isLive(b));
      if (d !== 0) return -d;
      return (a.name || a.id || '').localeCompare(b.name || b.id || '', undefined, { sensitivity: 'base' });
    });
  }, [providers]);

  const modalProvider = providers.find((p) => p.id === modalId) || null;

  const tileIcon = (stateKey) => {
    if (stateKey === 'verified') return <CheckCircle2 size={18} className="ob-provider-tile__icon ob-provider-tile__icon--ok" aria-hidden />;
    if (stateKey === 'configured') return <KeyRound size={18} className="ob-provider-tile__icon" aria-hidden />;
    return <Circle size={16} className="ob-provider-tile__icon ob-provider-tile__icon--muted" aria-hidden />;
  };

  return (
  <>
    <p className="onboarding-slide-body onboarding-slide-body--wide">
      Select an adapter to store credentials. Each tile opens a short form; verified adapters show green.
      {!isAdmin ? ' Your role can browse the catalog; an administrator saves live tokens.' : null}
      {' '}You can add more backends later under Configure → Integrations or Add backends in inventory.
    </p>

    {loading ? (
      <p className="onboarding-empty-note" role="status">Loading adapters…</p>
    ) : sortedProviders.length === 0 ? (
      <p className="onboarding-empty-note" role="status">
        No providers returned from the server. Skip this step to use the demo catalog, or add backends under Configure.
      </p>
    ) : (
      <div className="ob-provider-grid ob-provider-grid--tiles" role="list" aria-label="Provider adapters">
        {sortedProviders.map((p) => {
          const st = providerStatus(p, verBy);
          return (
            <button
              key={p.id}
              type="button"
              role="listitem"
              className={`ob-provider-tile ob-provider-tile--${st.key}`}
              onClick={() => setModalId(p.id)}
            >
              <span className="ob-provider-tile__row">
                {tileIcon(st.key)}
                <span className="ob-provider-tile__title">{p.name}</span>
              </span>
              <span className="ob-provider-tile__hint">
                {p.vendor} · {(p.modality || '').replace(/_/g, ' ')}
              </span>
              <span className={`ob-provider-tile__status ob-provider-tile__status--${st.key}`}>{st.label}</span>
            </button>
          );
        })}
      </div>
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