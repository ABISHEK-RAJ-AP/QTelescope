import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { api } from '../services/api';
import './AddBackendWizard.css';

const STEPS = [
  { id: 'provider', label: 'Choose provider' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'discover', label: 'Discover QPUs' },
];

function Stepper({ step }) {
  return (
    <ol className="bk-wizard__stepper" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li
            key={s.id}
            className={`bk-wizard__step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
            aria-current={active ? 'step' : undefined}
          >
            <span className="bk-wizard__step-dot" aria-hidden>
              {done ? <Check size={16} strokeWidth={2.5} /> : i + 1}
            </span>
            <span className="bk-wizard__step-label">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function AddBackendWizard({ open, onClose, onComplete, isAdmin }) {
  const [step, setStep] = useState(0);
  const [providers, setProviders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('');
  const [token, setToken] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setStep(0);
    setSelected(null);
    setFilter('');
    setToken('');
    setEndpoint('');
    setMsg(null);
    api.getCredentials().then((r) => setProviders(r?.providers || r || [])).catch(() => setProviders([]));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose?.(); };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => closeRef.current?.focus(), 40);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose, busy]);

  const provider = providers.find((p) => p.id === selected);
  const tokenField = (provider?.fields || []).find((f) => f.in === 'token');
  const urlField = (provider?.fields || []).find((f) => f.in === 'endpoint_url');
  const tokenRequired = Boolean(tokenField && tokenField.required !== false && !provider?.is_configured && !token.trim());
  const urlRequired = Boolean(
    urlField
    && urlField.required !== false
    && !provider?.is_configured
    && !endpoint.trim()
    && !(provider?.endpoint_url || '').trim(),
  );

  const filteredProviders = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) => {
      const name = (p.name || p.display_name || p.id || '').toLowerCase();
      return name.includes(q) || String(p.id).toLowerCase().includes(q);
    });
  }, [providers, filter]);

  const saveAndDiscover = useCallback(async () => {
    if (!provider) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.saveCredentials(provider.id, {
        token: token.trim() || undefined,
        endpoint_url: endpoint.trim() || provider.endpoint_url || undefined,
      });
      const discovery = await api.triggerAutoDiscovery();
      setMsg({
        type: 'ok',
        text: discovery?.message || `${discovery?.total_backends_discovered ?? 0} backend(s) synchronized.`,
      });
      onComplete?.();
      setTimeout(() => onClose?.(), 1400);
    } catch (e) {
      setMsg({ type: 'err', text: String(e.message || e) });
    } finally {
      setBusy(false);
    }
  }, [provider, token, endpoint, onClose, onComplete]);

  if (!open) return null;

  const stepSubtitle = [
    'Pick the cloud or on-prem adapter that owns the QPUs you want in inventory.',
    'Store provider credentials securely. Leave token blank to keep an existing secret.',
    'Pull registered backends from all configured providers into the library.',
  ][step];

  const content = (
    <div className="bk-wizard" role="presentation">
      <button type="button" className="bk-wizard__backdrop" aria-label="Close" onClick={onClose} disabled={busy} />
      <div className="bk-wizard__panel" role="dialog" aria-modal="true" aria-labelledby="bk-wizard-title" aria-describedby="bk-wizard-desc">
        <header className="bk-wizard__head">
          <div>
            <h2 id="bk-wizard-title">Add backends</h2>
            <p id="bk-wizard-desc" className="bk-wizard__subtitle">{stepSubtitle}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn btn-secondary btn-icon-only"
            onClick={onClose}
            aria-label="Close"
            disabled={busy}
          >
            <X size={18} />
          </button>
        </header>

        <Stepper step={step} />

        <div className="bk-wizard__body">
          {!isAdmin && (
            <p className="bk-wizard__alert" role="alert">
              Admin role required to save provider credentials and run discovery. You can browse providers; an admin must complete the flow.
            </p>
          )}

          {step === 0 && (
            <>
              <div className="bk-wizard__search">
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search providers…"
                  aria-label="Search providers"
                />
              </div>
              <div className="bk-wizard__list" role="listbox" aria-label="Providers">
                {filteredProviders.map((p) => {
                  const isSel = selected === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      className={`bk-wizard__provider${isSel ? ' is-selected' : ''}`}
                      onClick={() => setSelected(p.id)}
                    >
                      <span className="bk-wizard__provider-radio" aria-hidden>
                        <span className="bk-wizard__provider-radio-inner" />
                      </span>
                      <span className="bk-wizard__provider-main">
                        <span className="bk-wizard__provider-name">{p.name || p.display_name || p.id}</span>
                        <span className="bk-wizard__provider-id">{p.id}</span>
                      </span>
                      <span className="bk-wizard__provider-badges">
                        <span className={`bk-wizard__badge${p.is_configured ? ' bk-wizard__badge--ok' : ' bk-wizard__badge--muted'}`}>
                          {p.is_configured ? 'Configured' : 'New'}
                        </span>
                        {p.adapter_status === 'LIVE' && (
                          <span className="bk-wizard__badge bk-wizard__badge--live">Live</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {providers.length === 0 && (
                <p className="bk-wizard__empty">No providers loaded. Check Admin → Integrations.</p>
              )}
              {providers.length > 0 && filteredProviders.length === 0 && (
                <p className="bk-wizard__empty">No providers match your search.</p>
              )}
            </>
          )}

          {step === 1 && provider && (
            <div className="bk-wizard__form">
              <p className="bk-wizard__intro">
                Credentials for <strong>{provider.name || provider.display_name || provider.id}</strong>.
                Values are sent once over HTTPS and are not shown again in the UI.
              </p>
              {tokenField && (
                <div className="bk-wizard__field">
                  <label htmlFor="bk-wizard-token">
                    {tokenField.label || 'Provider token'}
                    <input
                      id="bk-wizard-token"
                      type="password"
                      autoComplete="off"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder={provider.is_configured ? 'Leave blank to keep existing secret' : 'Paste provider token'}
                    />
                    <span className="bk-wizard__field-hint">
                      {tokenField.required === false || provider.is_configured
                        ? 'Optional. Leave blank to keep a saved secret or skip if the catalog is public.'
                        : 'Required for first-time setup. Sent once; never shown again.'}
                    </span>
                  </label>
                </div>
              )}
              {urlField && (
                <div className="bk-wizard__field">
                  <label htmlFor="bk-wizard-endpoint">
                    {urlField.label || 'Endpoint URL'}
                    <input
                      id="bk-wizard-endpoint"
                      type="url"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder={provider.endpoint_url || 'https://…'}
                    />
                    <span className="bk-wizard__field-hint">
                      {urlField.required === false ? 'Optional custom gateway URL.' : 'Controller URL for on-prem discovery.'}
                    </span>
                  </label>
                </div>
              )}
              {!tokenField && !urlField && (
                <p className="bk-wizard__intro">This provider has no credential fields in the catalog.</p>
              )}
            </div>
          )}

          {step === 2 && provider && (
            <div className="bk-wizard__form">
              <dl className="bk-wizard__summary">
                <dt>Provider</dt>
                <dd>{provider.name || provider.display_name || provider.id}</dd>
                <dt>Credential</dt>
                <dd>{token.trim() || endpoint.trim() ? 'Will be saved' : (provider.is_configured ? 'Using existing secret' : 'None (public / optional)')}</dd>
                <dt>Discovery</dt>
                <dd>Registers QPUs from all configured providers into Backend library.</dd>
              </dl>
              {msg && (
                <p
                  className={`bk-wizard__status bk-wizard__status--${msg.type === 'err' ? 'err' : 'ok'}`}
                  role="status"
                >
                  {msg.text}
                </p>
              )}
            </div>
          )}
        </div>

        <footer className="bk-wizard__foot">
          {step > 0 ? (
            <button type="button" className="btn btn-secondary bk-wizard__foot-spacer" disabled={busy} onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          ) : (
            <span className="bk-wizard__foot-spacer" />
          )}
          {step < 2 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!isAdmin || (step === 0 && !selected) || (step === 1 && (tokenRequired || urlRequired))}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
            </button>
          )}
          {step === 2 && (
            <button type="button" className="btn btn-primary" disabled={!isAdmin || busy} onClick={saveAndDiscover}>
              {busy ? 'Discovering…' : 'Save & discover'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
