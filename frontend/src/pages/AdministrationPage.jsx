import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save, RefreshCw, CheckCircle2, Cpu, AlertTriangle, Key, Eye, EyeOff, Plus, Trash2, X,
  Compass, Pencil, ShieldCheck,
} from 'lucide-react';
import { markOnboardingPending } from '../lib/onboardingState';
import { api } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { TableEmpty } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { ConfirmDialog } from '../components/observability/ConfirmDialog.jsx';
import { Toggle } from '../components/ui/Toggle.jsx';
import { RoleMatrix } from '../components/admin/RoleMatrix.jsx';
import { roleLabel } from '../lib/permissions.js';
import { ListPager } from '../components/observability/ListPager.jsx';
import './AdministrationPage.css';

const ADMIN_SECTIONS = [
  { id: 'integrations', label: 'Integrations' },
  { id: 'collectors', label: 'Collectors' },
  { id: 'rules', label: 'Alert rules' },
  { id: 'users', label: 'Users & roles' },
];

const METRICS = [
  ['T1', 'T1 coherence (µs)'], ['T2', 'T2 dephasing (µs)'], ['READOUT_ERROR', 'Readout error rate'],
  ['GATE_ERROR_1Q', '1Q gate error'], ['GATE_ERROR_2Q', '2Q gate error'], ['QUEUE_JOBS', 'Pending queue backlog'],
  ['CALIBRATION_AGE', 'Calibration age (h)'], ['FREQUENCY_DRIFT', 'Frequency drift (MHz)'],
];
const OPERATORS = ['<', '<=', '>', '>=', '=='];
const SEVERITIES = ['CRITICAL', 'WARNING', 'INFO'];
const EMPTY_RULE = { rule_id: '', metric_name: 'T1', operator: '<', threshold_value: '', severity: 'WARNING', enabled: true, description: '' };
const FRESH_MS = 6 * 3600 * 1000; // telemetry "flowing" = last success within 6h

const isAdminRole = () => {
  try {
    const u = JSON.parse(localStorage.getItem('quantum_user') || 'null');
    return ['Admin', 'PlatformAdmin', 'QuantumOpsAdmin', 'SecurityAdmin'].includes(u?.role);
  } catch { return false; }
};
const fmtTime = (t) => (t ? new Date(t).toLocaleString() : '—');
const errText = (e) => String(e?.message || e).replace(/^Error:\s*/, '');

function Stage({ ok, label, title }) {
  // ok: true | false | null (unknown / not run)
  const cls = ok === true ? 'badge-online' : ok === false ? 'badge-offline' : 'badge-info';
  return <span className={`badge ${cls}`} title={title}>{label}</span>;
}

function Notice({ note }) {
  if (!note) return null;
  return <div className={`admin-notice admin-notice--${note.type}`} role={note.type === 'error' ? 'alert' : 'status'}>{note.text}</div>;
}

function mqttBadgeClass(status) {
  if (status === 'LIVE' || status === 'CONNECTING') return 'badge-online';
  if (status === 'DISABLED' || status === 'NEEDS_CLIENT') return 'badge-info';
  return 'badge-warning';
}

/* --------------------------- Integrations --------------------------- */
function Integrations({ providers, health, verification, setVerification, canEdit, reload, navigate }) {
  const [drafts, setDrafts] = useState({});
  const [reveal, setReveal] = useState({});
  const [fb, setFb] = useState({});
  const [verifying, setVerifying] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discovery, setDiscovery] = useState(null);
  const [confirm, setConfirm] = useState(null); // provider id awaiting confirm
  const [open, setOpen] = useState(null);
  const [ldap, setLdap] = useState(null);

  useEffect(() => {
    api.getConfigStatus().then((s) => setLdap(s?.ldap || { enabled: false })).catch(() => setLdap({ enabled: false }));
  }, []);

  const healthBy = useMemo(() => Object.fromEntries((health || []).map((h) => [h.provider_id, h])), [health]);
  const verBy = useMemo(() => Object.fromEntries((verification || []).map((v) => [v.provider_id, v])), [verification]);
  const reason = canEdit ? undefined : 'Admin role required';

  const runVerify = async () => {
    setVerifying(true);
    try { setVerification((await api.getAdapterVerification()).results || []); setFb((f) => ({ ...f, _v: { type: 'success', text: 'Verification complete.' } })); }
    catch (e) { setFb((f) => ({ ...f, _v: { type: 'error', text: `Verification failed: ${errText(e)}` } })); }
    finally { setVerifying(false); }
  };
  const runDiscovery = async () => {
    setDiscovering(true); setDiscovery(null);
    try { setDiscovery(await api.triggerAutoDiscovery()); await reload(); }
    catch (e) { setDiscovery({ error: errText(e) }); }
    finally { setDiscovering(false); }
  };

  const fieldVal = (p, f) => {
    const d = drafts[p.id] || {};
    if (f.in === 'extra') return d.extra?.[f.key] ?? p.public_fields?.[f.key] ?? '';
    if (f.in === 'endpoint_url') return d.endpoint_url ?? p.endpoint_url ?? p.public_fields?.endpoint_url ?? '';
    return d[f.in] ?? '';
  };
  const setField = (p, f, v) => setDrafts((prev) => {
    const cur = prev[p.id] || {};
    if (f.in === 'extra') return { ...prev, [p.id]: { ...cur, extra: { ...(cur.extra || {}), [f.key]: v } } };
    return { ...prev, [p.id]: { ...cur, [f.in]: v } };
  });
  const dirty = (p) => {
    const d = drafts[p.id];
    return !!d && (d.token || d.endpoint_url !== undefined || Object.keys(d.extra || {}).length > 0);
  };
  const errors = (p) => {
    const e = {};
    p.fields.forEach((f) => {
      const v = String(fieldVal(p, f) || '').trim();
      // secrets are never echoed back, so an empty secret on an already-configured provider means "keep"
      if (f.required !== false && !v && !(f.secret && p.is_configured)) e[f.key] = `${f.label} is required`;
      else if (f.in === 'endpoint_url' && v && !/^https?:\/\//i.test(v)) e[f.key] = 'Must start with http:// or https://';
      else if (f.secret && v && v.length < 8) e[f.key] = 'Looks too short for a credential';
    });
    return e;
  };
  const cancel = (p) => setDrafts((d) => { const n = { ...d }; delete n[p.id]; return n; });
  const save = async (p) => {
    const d = drafts[p.id] || {};
    setConfirm(null);
    setFb((f) => ({ ...f, [p.id]: { type: 'info', text: 'Saving…' } }));
    try {
      const res = await api.saveCredentials(p.id, {
        token: d.token || undefined,
        endpoint_url: d.endpoint_url || p.endpoint_url || p.public_fields?.endpoint_url || undefined,
        extra: d.extra,
      });
      cancel(p); // drop secret from memory
      setFb((f) => ({ ...f, [p.id]: { type: 'success', text: res.message || 'Saved.' } }));
      await reload();
    } catch (e) {
      setFb((f) => ({ ...f, [p.id]: { type: 'error', text: errText(e) } }));
    }
  };

  return (
    <>
      <div className="card admin-toolbar-card">
        <div className="admin-toolbar-card__row">
          <div>
            <h3 className="admin-card-title" style={{ marginBottom: 2 }}>Provider status</h3>
            <p className="page-hint" style={{ margin: 0 }}>
              Four independent checks per provider. “Verified” only appears after you run live verification (needs env token on server).
            </p>
          </div>
          <div className="admin-actions">
            <button type="button" className="btn btn-secondary" onClick={runVerify} disabled={verifying || !canEdit} title={reason}>
              <ShieldCheck size={14} /> {verifying ? 'Verifying…' : 'Run live verification'}
            </button>
            <button type="button" className="btn btn-primary" onClick={runDiscovery} disabled={discovering || !canEdit} title={reason || 'Probe configured providers and sync backend catalog'}>
              <RefreshCw size={14} className={discovering ? 'spin-icon' : ''} /> {discovering ? 'Scanning…' : 'Auto-discover QPUs'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                try {
                  const u = JSON.parse(localStorage.getItem('quantum_user') || 'null');
                  if (u?.username) markOnboardingPending(u.username);
                } catch { /* ignore */ }
                navigate('/app/onboarding');
              }}
            >
              <Compass size={14} /> Platform setup
            </button>
          </div>
        </div>
        <Notice note={fb._v} />
        {discovery && (
          discovery.error
            ? <Notice note={{ type: 'error', text: `Discovery failed: ${discovery.error}` }} />
            : (
              <div className="admin-discovery-results">
                <div className="admin-discovery-status-line"><CheckCircle2 size={16} /> {discovery.total_backends_discovered || 0} backend(s) synchronized</div>
                <div className="admin-discovery-grid">
                  {discovery.providers?.map((p) => (
                    <div key={p.provider_name} className="admin-discovery-provider-chip">
                      <div className="admin-discovery-chip-name">{p.provider_name}</div>
                      <div className="admin-discovery-chip-backends"><strong>{p.backends_detected} QPUs</strong> {p.backend_names?.join(', ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
        )}
      </div>

      <div className="card admin-pad" style={{ marginBottom: 14 }}>
        <h3 className="admin-card-title">Directory login (LDAP)</h3>
        {!ldap || !ldap.enabled ? (
          <p className="page-hint">
            LDAP is off. Set <code>LDAP_URL</code> and <code>LDAP_USER_DN</code> (example <code>uid={'{username}'},ou=people,dc=example,dc=com</code>) then restart the API.
            Optional <code>LDAP_DEFAULT_ROLE</code> and <code>LDAP_GROUP_ROLE_MAP</code> as <code>cn=ops=OpsEngineer;cn=sec=SecurityAdmin</code>.
            Install <code>ldap3</code>. This is directory bind, not SSO/SAML.
          </p>
        ) : (
          <p className="page-hint">
            LDAP bind against <strong>{ldap.host}</strong> ({ldap.mode}
            {ldap.library ? '' : ' — ldap3 missing, logins will 503'}).
            Default role {ldap.default_role}. Local accounts are tried first.
          </p>
        )}
      </div>

      <div className="card" style={{ padding: 0 }} data-tour="page-admin-providers">
        <div className="table-container" style={{ border: 'none' }}>
          <table className="custom-table admin-table">
            <thead>
              <tr>
                <th>Provider</th><th>Adapter</th><th>Credentials</th><th>Connection</th><th>Telemetry</th><th style={{ textAlign: 'right' }}>Configure</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => {
                const live = p.adapter === 'live' || p.adapter_status === 'LIVE';
                const v = verBy[p.id];
                const h = healthBy[p.id];
                const simulated = /simulat|stub|mock/i.test(h?.lineage || '');
                const flowing = simulated ? null : h?.last_success_at ? Date.now() - new Date(h.last_success_at).getTime() < FRESH_MS : (h ? false : null);
                const conn = !live ? null : v ? (v.skipped ? null : !!v.verified) : null;
                return (
                  <React.Fragment key={p.id}>
                    <tr>
                      <td><strong>{p.name}</strong><div className="admin-sub">{p.vendor} · {p.modality}</div></td>
                      <td><Stage ok={live} label={live ? 'Implemented' : 'Stub only'} title={live ? 'Polling adapter exists' : 'Credentials are stored but no poll adapter is installed'} /></td>
                      <td><Stage ok={p.is_configured} label={p.is_configured ? 'Configured' : 'Not set'} /></td>
                      <td>
                        <Stage
                          ok={conn}
                          label={!live ? 'N/A' : v ? (v.skipped ? 'Not testable' : v.verified ? 'Verified' : 'Failed') : 'Not run'}
                          title={v?.skipped ? v.reason : v?.truth_label}
                        />
                      </td>
                      <td>
                        <Stage ok={flowing} label={simulated ? 'Simulated' : flowing ? 'Flowing' : h ? 'Stale / failing' : 'No runs'} title={h ? `Lineage ${h.lineage || '?'} · Last run ${fmtTime(h.last_run_at)} · last success ${fmtTime(h.last_success_at)}` : 'No collector run recorded'} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className="btn btn-secondary btn--xs" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
                          <Pencil size={12} /> {open === p.id ? 'Close' : 'Edit'}
                        </button>
                      </td>
                    </tr>
                    {open === p.id && (
                      <tr className="admin-row-detail">
                        <td colSpan={6}>
                          <form className="admin-cred-form" onSubmit={(e) => { e.preventDefault(); if (!Object.keys(errors(p)).length) setConfirm(p.id); }}>
                            <p className="page-hint" style={{ margin: 0 }}>
                              {p.truth_help} Saved secrets are never shown; leave a secret blank to keep the existing one.
                              {live ? ' Saving authenticates against the vendor and runs a collection cycle.' : ' Stub: stored only, not polled.'}
                            </p>
                            <div className="admin-cred-fields">
                              {p.fields.map((f) => {
                                const err = dirty(p) ? errors(p)[f.key] : null;
                                return (
                                  <label key={f.key} className="admin-field">
                                    <span className="admin-input-label">{f.label}{f.required === false ? ' (optional)' : ''}</span>
                                    <span className="admin-input-wrapper">
                                      <input
                                        type={f.secret && !reveal[`${p.id}.${f.key}`] ? 'password' : 'text'}
                                        className="input-control admin-input-field"
                                        value={fieldVal(p, f)}
                                        placeholder={f.secret && p.is_configured ? '•••••••• (saved)' : f.label}
                                        autoComplete="off"
                                        disabled={!canEdit}
                                        aria-invalid={!!err}
                                        onChange={(e) => setField(p, f, e.target.value)}
                                      />
                                      {f.secret && (
                                        <button type="button" className="admin-input-toggle-btn" aria-label="Toggle visibility" onClick={() => setReveal((r) => ({ ...r, [`${p.id}.${f.key}`]: !r[`${p.id}.${f.key}`] }))}>
                                          {reveal[`${p.id}.${f.key}`] ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                      )}
                                    </span>
                                    {err && <span className="admin-field-error">{err}</span>}
                                  </label>
                                );
                              })}
                            </div>
                            <div className="admin-cred-footer">
                              <button type="submit" className="btn btn-primary" disabled={!canEdit || !dirty(p) || fb[p.id]?.text === 'Saving…'} title={reason || (dirty(p) ? undefined : 'No changes')}>
                                <Save size={14} /> Save
                              </button>
                              <button type="button" className="btn btn-secondary" disabled={!dirty(p)} onClick={() => cancel(p)}>Cancel</button>
                              {dirty(p) && <span className="admin-dirty">Unsaved changes</span>}
                              <Notice note={fb[p.id]} />
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirm && (
        <Modal title="Save credentials" onClose={() => setConfirm(null)}
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={() => save(providers.find((x) => x.id === confirm))}>Save credentials</button></>}>
          <p>Overwrites stored credentials for <strong>{providers.find((x) => x.id === confirm)?.name}</strong>. Live adapters validate the secret with the vendor and trigger telemetry collection immediately.</p>
        </Modal>
      )}
    </>
  );
}

function Modal({ title, children, footer, onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal-card" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{title}</div>
          <button type="button" className="admin-modal-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="admin-modal-body">{children}</div>
        {footer && <div className="admin-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/* ----------------------------- Collectors ----------------------------- */
function Collectors({ schedules, health, dlq, mqtt, scheduler, canEdit, reload }) {
  const [edits, setEdits] = useState({}); // category -> {interval, enabled}
  const [fb, setFb] = useState({});
  const [runNote, setRunNote] = useState(null);
  const [running, setRunning] = useState(false);
  const [purgingDlq, setPurgingDlq] = useState(false);
  const [collectorConfirm, setCollectorConfirm] = useState(null);
  const reason = canEdit ? undefined : 'Admin role required';

  const runCollectionNow = async () => {
    setRunning(true);
    setRunNote(null);
    try {
      const r = await api.runCollection();
      setRunNote({ type: 'success', text: `Collection finished — ${r?.total_backends_discovered ?? 0} backend(s) across providers.` });
      await reload();
    } catch (e) {
      setRunNote({ type: 'error', text: errText(e) });
    } finally {
      setRunning(false);
    }
  };

  const purgeDlq = async () => {
    setPurgingDlq(true);
    try {
      const r = await api.purgeCollectorDlq();
      setRunNote({ type: 'success', text: `DLQ cleared (${r?.entries_removed ?? 0} entries).` });
      await reload();
    } catch (e) {
      setRunNote({ type: 'error', text: errText(e) });
    } finally {
      setPurgingDlq(false);
    }
  };

  const cur = (s) => edits[s.category] ?? { interval: String(s.interval_seconds), enabled: !!s.enabled };
  const isDirty = (s) => { const c = edits[s.category]; return !!c && (c.interval !== String(s.interval_seconds) || c.enabled !== !!s.enabled); };
  const intervalErr = (s) => { const n = Number(cur(s).interval); return Number.isInteger(n) && n >= 10 && n <= 86400 ? null : 'Whole seconds, 10–86400'; };
  const patch = (s, p) => setEdits((e) => ({ ...e, [s.category]: { ...cur(s), ...p } }));
  const save = async (s) => {
    const c = cur(s);
    try {
      await api.updateSchedule({ category: s.category, interval_seconds: Number(c.interval), enabled: c.enabled });
      setEdits((e) => { const n = { ...e }; delete n[s.category]; return n; });
      setFb((f) => ({ ...f, [s.category]: { type: 'success', text: 'Saved' } }));
      await reload();
    } catch (e) { setFb((f) => ({ ...f, [s.category]: { type: 'error', text: errText(e) } })); }
  };
  const failures = dlq?.failures || [];
  const breakers = Object.entries(dlq?.circuit_breakers || {});

  return (
    <>
      <div className="card admin-kv-card">
        <h3 className="admin-card-title">Scheduler</h3>
        <dl className="admin-kv">
          <div><dt>Background scheduler</dt><dd><span className={`badge ${scheduler?.enabled ? 'badge-online' : 'badge-offline'}`}>{scheduler?.enabled ? 'Enabled' : 'Disabled'}</span></dd></div>
          <div><dt>Tick</dt><dd>{scheduler ? `${scheduler.tick_seconds}s` : '—'}</dd></div>
          <div><dt>Facility MQTT</dt><dd><span className={`badge ${mqttBadgeClass(mqtt?.status)}`}>{mqtt?.status || '—'}</span></dd></div>
        </dl>
        {mqtt?.note && <p className="page-hint admin-kv__note" style={{ marginBottom: 8 }}>{mqtt.note}</p>}
        <div className="admin-actions admin-kv__note" style={{ marginTop: 0 }}>
          <button type="button" className="btn btn-primary btn--xs" disabled={!canEdit || running} title={reason} onClick={() => setCollectorConfirm('run')}>
            {running ? 'Collecting…' : 'Run collection now'}
          </button>
          <span className="admin-sub">Polls configured providers and refreshes telemetry (includes demo catalog when enabled).</span>
        </div>
        <Notice note={runNote} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <h3 className="admin-card-title admin-pad">Collection schedules</h3>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="custom-table admin-table">
            <thead><tr><th>Category</th><th>Interval (s)</th><th>Enabled</th><th>Last run</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {schedules.map((s) => {
                const c = cur(s);
                const err = intervalErr(s);
                const last = scheduler?.schedules?.find((x) => x.category === s.category)?.last_run;
                return (
                  <tr key={s.category}>
                    <td><strong>{s.category}</strong></td>
                    <td>
                      <input type="number" min="10" max="86400" className="input-control admin-num" value={c.interval} disabled={!canEdit} aria-invalid={!!err}
                        onChange={(e) => patch(s, { interval: e.target.value })} />
                      {isDirty(s) && err && <div className="admin-field-error">{err}</div>}
                    </td>
                    <td>
                      <Toggle checked={c.enabled} disabled={!canEdit} label={c.enabled ? 'On' : 'Off'} onChange={(v) => patch(s, { enabled: v })} />
                    </td>
                    <td className="admin-sub">{fmtTime(last)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {isDirty(s) && <span className="admin-dirty">Unsaved</span>}{' '}
                      <button type="button" className="btn btn-primary btn--xs" disabled={!canEdit || !isDirty(s) || !!err} title={reason} onClick={() => save(s)}>Save</button>{' '}
                      <button type="button" className="btn btn-secondary btn--xs" disabled={!isDirty(s)} onClick={() => setEdits((e) => { const n = { ...e }; delete n[s.category]; return n; })}>Cancel</button>
                      <Notice note={fb[s.category]} />
                    </td>
                  </tr>
                );
              })}
              {schedules.length === 0 && <TableEmpty colSpan={5} title="No schedules" message="No collection schedules defined." />}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <h3 className="admin-card-title admin-pad">Per-provider last run</h3>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="custom-table admin-table">
            <thead><tr><th>Provider</th><th>Status</th><th>Last success</th><th>Last run</th><th>Duration</th><th>Last error</th></tr></thead>
            <tbody>
              {health.map((h) => (
                <tr key={h.provider_id}>
                  <td><strong>{h.provider_id}</strong></td>
                  <td><Stage ok={h.status === 'OK'} label={h.status} /></td>
                  <td className="admin-sub">{fmtTime(h.last_success_at)}</td>
                  <td className="admin-sub">{fmtTime(h.last_run_at)}</td>
                  <td>{h.duration_ms != null ? `${h.duration_ms} ms` : '—'}</td>
                  <td className="admin-sub admin-err-cell">{h.error || '—'}</td>
                </tr>
              ))}
              {health.length === 0 && <TableEmpty colSpan={6} title="No collector runs" message="Run discovery from Integrations to populate run history." />}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <h3 className="admin-card-title admin-pad">Dead-letter queue (recent failures)</h3>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="custom-table admin-table">
            <thead><tr><th>Time</th><th>Provider</th><th>Status</th><th>Error</th></tr></thead>
            <tbody>
              {failures.map((f) => (
                <tr key={f.id}><td className="admin-sub">{fmtTime(f.at)}</td><td>{f.provider_id}</td><td>{f.status}</td><td className="admin-err-cell">{f.error || '—'}</td></tr>
              ))}
              {failures.length === 0 && <TableEmpty colSpan={4} title="Dead-letter queue empty" message="No collector failures in the DLQ." />}
            </tbody>
          </table>
        </div>
        {breakers.length > 0 && (
          <p className="page-hint admin-pad">Circuit breakers: {breakers.map(([k, v]) => `${k}: ${v?.state || v?.status || JSON.stringify(v)}`).join(' · ')}</p>
        )}
        <div className="admin-pad admin-actions" style={{ paddingTop: 0 }}>
          <button type="button" className="btn btn-secondary btn--xs" disabled={!canEdit || purgingDlq || failures.length === 0} title={reason} onClick={() => setCollectorConfirm('purge')}>
            {purgingDlq ? 'Clearing…' : 'Clear DLQ history'}
          </button>
          <span className="admin-sub">Removes local failure log (SQLite lock errors from old runs, etc.). Does not replay jobs.</span>
        </div>
      </div>
      {collectorConfirm === 'run' && (
        <ConfirmDialog
          dlg={{
            title: 'Run collection now?',
            body: 'Polls every configured provider and refreshes backend telemetry. This can add load on vendor APIs.',
            confirm: 'Yes, run now',
            onConfirm: async () => {
              setCollectorConfirm(null);
              await runCollectionNow();
            },
          }}
          busy={running}
          onCancel={() => !running && setCollectorConfirm(null)}
        />
      )}
      {collectorConfirm === 'purge' && (
        <ConfirmDialog
          danger
          dlg={{
            title: 'Clear DLQ history?',
            body: 'Removes stored collector failure records on this server. You cannot undo this.',
            confirm: 'Yes, clear',
            onConfirm: async () => {
              setCollectorConfirm(null);
              await purgeDlq();
            },
          }}
          busy={purgingDlq}
          onCancel={() => !purgingDlq && setCollectorConfirm(null)}
        />
      )}
    </>
  );
}

/* ------------------------------- Rules ------------------------------- */
function Rules({ rules, canEdit, reload }) {
  const [editing, setEditing] = useState(null); // {mode:'create'|'edit', orig, form}
  const [deleting, setDeleting] = useState(null);
  const [discardAsk, setDiscardAsk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [note, setNote] = useState(null);
  const reason = canEdit ? undefined : 'Admin role required';

  const open = (r) => {
    setFormErr(null);
    setEditing(r
      ? { mode: 'edit', orig: r, form: { ...r, threshold_value: String(r.threshold_value), description: r.description || '' } }
      : { mode: 'create', orig: EMPTY_RULE, form: { ...EMPTY_RULE } });
  };
  const validate = (f, mode) => {
    const e = {};
    if (mode === 'create' && f.rule_id) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(f.rule_id)) e.rule_id = 'Letters, digits, _ and - only (max 64)';
      else if (rules.some((r) => r.rule_id === f.rule_id)) e.rule_id = 'ID already exists';
    }
    if (f.threshold_value === '' || !Number.isFinite(Number(f.threshold_value))) e.threshold_value = 'Enter a number';
    else if (Number(f.threshold_value) < 0) e.threshold_value = 'Must be ≥ 0';
    return e;
  };
  const isDirty = editing && JSON.stringify({ ...editing.form, threshold_value: String(editing.form.threshold_value) })
    !== JSON.stringify({ ...editing.orig, threshold_value: String(editing.orig.threshold_value), description: editing.orig.description || '' });
  const errs = editing ? validate(editing.form, editing.mode) : {};
  const setF = (p) => setEditing((s) => ({ ...s, form: { ...s.form, ...p } }));

  const submit = async (e) => {
    e.preventDefault();
    if (Object.keys(errs).length) return;
    setSaving(true); setFormErr(null);
    const body = { ...editing.form, threshold_value: Number(editing.form.threshold_value) };
    try {
      if (editing.mode === 'create') {
        if (!body.rule_id) delete body.rule_id;
        await api.createAlertRule(body);
      } else {
        const { rule_id, ...rest } = body;
        await api.updateAlertRule(rule_id, rest);
      }
      setNote({ type: 'success', text: `Rule ${editing.mode === 'create' ? 'created' : 'updated'}.` });
      setEditing(null);
      await reload();
    } catch (er) { setFormErr(errText(er)); } finally { setSaving(false); }
  };
  const toggle = async (r) => {
    try { await api.updateAlertRule(r.rule_id, { enabled: !r.enabled }); setNote({ type: 'success', text: `${r.rule_id} ${r.enabled ? 'disabled' : 'enabled'}.` }); await reload(); }
    catch (er) { setNote({ type: 'error', text: `Toggle failed: ${errText(er)}` }); }
  };
  const doDelete = async () => {
    const id = deleting; setDeleting(null);
    try { await api.deleteAlertRule(id); setNote({ type: 'success', text: `Rule ${id} deleted.` }); await reload(); }
    catch (er) { setNote({ type: 'error', text: `Delete failed: ${errText(er)}` }); }
  };

  return (
    <>
      <div className="card" style={{ padding: 0 }}>
        <div className="admin-card-header-actions admin-pad">
          <div>
            <h3 className="admin-card-title" style={{ marginBottom: 2 }}>Alert rules</h3>
            <p className="page-hint" style={{ margin: 0 }}>Threshold rules evaluated against backend telemetry.</p>
          </div>
          <button type="button" className="btn btn-primary" disabled={!canEdit} title={reason} onClick={() => open(null)}><Plus size={14} /> Add rule</button>
        </div>
        <div className="admin-pad" style={{ paddingTop: 0 }}><Notice note={note} /></div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="custom-table admin-table">
            <thead><tr><th>Rule</th><th>Condition</th><th>Severity</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.rule_id}>
                  <td><strong className="admin-mono">{r.rule_id}</strong><div className="admin-sub">{r.description}</div></td>
                  <td className="admin-mono">{r.metric_name} {r.operator} {r.threshold_value}</td>
                  <td><span className={`badge ${r.severity === 'CRITICAL' ? 'badge-critical' : r.severity === 'WARNING' ? 'badge-warning' : 'badge-info'}`}>{r.severity}</span></td>
                  <td>
                    <Toggle checked={!!r.enabled} disabled={!canEdit} label={r.enabled ? 'Enabled' : 'Disabled'} onChange={() => toggle(r)} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn btn-secondary btn--xs" disabled={!canEdit} title={reason} onClick={() => open(r)}><Pencil size={12} /> Edit</button>{' '}
                    <button type="button" className="admin-table-action-btn" disabled={!canEdit} title={reason || `Delete ${r.rule_id}`} aria-label={`Delete ${r.rule_id}`} onClick={() => setDeleting(r.rule_id)}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && <TableEmpty colSpan={5} title="No alert rules" message="Add a rule to define thresholds and escalation." />}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal title={editing.mode === 'create' ? 'Add alert rule' : `Edit ${editing.orig.rule_id}`}
          onClose={() => { if (!isDirty) setEditing(null); else setDiscardAsk(true); }}>
          <form onSubmit={submit} className="admin-rule-form">
            {formErr && <Notice note={{ type: 'error', text: formErr }} />}
            {editing.mode === 'create' && (
              <label className="admin-field"><span className="admin-input-label">Rule ID (optional, auto if empty)</span>
                <input className="input-control" value={editing.form.rule_id} onChange={(e) => setF({ rule_id: e.target.value })} placeholder="rule_low_t1" aria-invalid={!!errs.rule_id} />
                {errs.rule_id && <span className="admin-field-error">{errs.rule_id}</span>}
              </label>
            )}
            <div className="admin-modal-grid-2">
              <label className="admin-field"><span className="admin-input-label">Metric</span>
                <select className="input-control" value={editing.form.metric_name} onChange={(e) => setF({ metric_name: e.target.value })}>
                  {METRICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></label>
              <label className="admin-field"><span className="admin-input-label">Operator</span>
                <select className="input-control" value={editing.form.operator} onChange={(e) => setF({ operator: e.target.value })}>
                  {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select></label>
            </div>
            <div className="admin-modal-grid-2">
              <label className="admin-field"><span className="admin-input-label">Threshold</span>
                <input type="number" step="any" className="input-control" value={editing.form.threshold_value} onChange={(e) => setF({ threshold_value: e.target.value })} aria-invalid={!!errs.threshold_value} />
                {errs.threshold_value && <span className="admin-field-error">{errs.threshold_value}</span>}
              </label>
              <label className="admin-field"><span className="admin-input-label">Severity</span>
                <select className="input-control" value={editing.form.severity} onChange={(e) => setF({ severity: e.target.value })}>
                  {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
                </select></label>
            </div>
            <label className="admin-field"><span className="admin-input-label">Description (optional)</span>
              <input className="input-control" value={editing.form.description} onChange={(e) => setF({ description: e.target.value })} /></label>
            <Toggle checked={!!editing.form.enabled} label="Rule enabled" onChange={(v) => setF({ enabled: v })} />
            <div className="admin-modal-footer admin-modal-footer--inline">
              {isDirty && <span className="admin-dirty">Unsaved changes</span>}
              <button type="button" className="btn btn-secondary" onClick={() => { if (!isDirty) setEditing(null); else setDiscardAsk(true); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving || !isDirty || Object.keys(errs).length > 0}>{saving ? 'Saving…' : 'Save rule'}</button>
            </div>
          </form>
        </Modal>
      )}
      {discardAsk && (
        <ConfirmDialog
          dlg={{
            title: 'Discard unsaved changes?',
            body: 'Your edits to this alert rule will be lost.',
            confirm: 'Discard',
            danger: true,
            onConfirm: () => { setDiscardAsk(false); setEditing(null); },
          }}
          onCancel={() => setDiscardAsk(false)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          danger
          dlg={{
            title: 'Delete alert rule?',
            body: `Rule ${deleting} will be permanently removed. This cannot be undone.`,
            confirm: 'Yes, delete',
            onConfirm: doDelete,
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}

/* ------------------------------ Users ------------------------------ */
const USER_SORTS = [
  { key: 'username', label: 'Username (A–Z)' },
  { key: 'role', label: 'Role' },
  { key: 'mfa', label: 'MFA status' },
  { key: 'org', label: 'Organization' },
];

function UsersDirectory({ canEdit }) {
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('username');
  const [page, setPage] = useState(1);
  const USER_PAGE = 20;

  const load = useCallback(async () => {
    try {
      const [users, catalog] = await Promise.all([
        api.listUsers(),
        api.getRolesCatalog().catch(() => ({ roles: [] })),
      ]);
      setRows(users || []);
      setRoles(catalog?.roles || []);
      setErr(null);
    } catch (e) {
      setErr(errText(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRole = async (username, role) => {
    setBusy(username);
    try {
      await api.assignUserRole(username, role);
      await load();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((u) => (
        `${u.username} ${u.full_name || ''} ${u.email || ''} ${u.role || ''} ${u.org || ''}`.toLowerCase().includes(q)
      ));
    }
    const sorted = [...list].sort((a, b) => {
      if (sortKey === 'mfa') {
        return Number(Boolean(b.mfa_enabled)) - Number(Boolean(a.mfa_enabled))
          || String(a.username).localeCompare(String(b.username));
      }
      if (sortKey === 'role') {
        return roleLabel(a.role).localeCompare(roleLabel(b.role)) || String(a.username).localeCompare(String(b.username));
      }
      if (sortKey === 'org') {
        return String(a.org || '').localeCompare(String(b.org || '')) || String(a.username).localeCompare(String(b.username));
      }
      return String(a.username).localeCompare(String(b.username));
    });
    return sorted;
  }, [rows, search, sortKey]);
  useEffect(() => { setPage(1); }, [search, sortKey]);
  const userPages = Math.max(1, Math.ceil(visible.length / USER_PAGE));
  const userPage = Math.min(page, userPages);
  const pageUsers = visible.slice((userPage - 1) * USER_PAGE, userPage * USER_PAGE);

  return (
    <>
      <RoleMatrix compact />
      <div className="card admin-users">
        <h3 className="admin-card-title">User directory</h3>
        <p className="page-hint">Search accounts and assign roles. Capabilities follow the matrix above.</p>
        {err && <Notice note={{ type: 'error', text: err }} />}
        <div className="admin-users-toolbar">
          <label className="admin-users-search">
            <span className="sr-only">Search users</span>
            <input
              type="search"
              className="input-control"
              placeholder="Search name, email, role, org…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            Sort
            <select className="input-control" value={sortKey} onChange={(e) => setSortKey(e.target.value)} aria-label="Sort users">
              {USER_SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <span className="admin-users-count" role="status">{visible.length} of {rows.length} users</span>
        </div>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>MFA</th>
                <th>Organization</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <TableEmpty colSpan={4} title="No users" message="Registered accounts appear here." />
              ) : visible.length === 0 ? (
                <TableEmpty colSpan={4} title="No matches" message="Try a different search term." />
              ) : pageUsers.map((u) => (
                <tr key={u.username}>
                  <td>
                    <div>{u.full_name || u.username}</div>
                    <div className="al-sub">{u.email || u.username}</div>
                  </td>
                  <td>
                    {canEdit ? (
                      <select
                        className="input-control admin-users-role-select"
                        value={u.role || 'Operator'}
                        disabled={busy === u.username}
                        aria-label={`Role for ${u.username}`}
                        onChange={(e) => onRole(u.username, e.target.value)}
                      >
                        {(roles.length ? roles : [{ id: u.role, label: u.role }]).map((r) => (
                          <option key={r.id || r.role} value={r.id || r.role}>{r.label || r.id}</option>
                        ))}
                      </select>
                    ) : (roleLabel(u.role) || u.role || 'Operator')}
                  </td>
                  <td>{u.mfa_enabled ? 'Enrolled' : 'Off'}</td>
                  <td>{u.org || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ListPager page={userPage} pages={userPages} onPage={setPage} />
      </div>
    </>
  );
}

/* ------------------------------- Page ------------------------------- */
export const AdministrationPage = ({ section = 'integrations', onNavigateSection }) => {
  const navigate = useNavigate();
  const active = section === 'hub' ? 'integrations' : (ADMIN_SECTIONS.some((s) => s.id === section) ? section : 'integrations');
  const go = useCallback((id) => (onNavigateSection ? onNavigateSection(id) : navigate(`/app/admin/${id === 'hub' ? 'integrations' : id}`)), [onNavigateSection, navigate]);
  const canEdit = isAdminRole();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [verification, setVerification] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const { setActions, clearActions } = usePageActions();

  const load = useCallback(async () => {
    const miss = [];
    const t = (name, p, fallback) => p.catch(() => { miss.push(name); return fallback; });
    const [creds, schedules, rules, dlq, mqtt, health, scheduler] = await Promise.all([
      t('credentials', api.getCredentials(), null),
      t('schedules', api.getSchedules(), []),
      t('alert rules', api.getAlertRules(), []),
      t('DLQ', api.getCollectorDlq(), null),
      t('MQTT', api.getFacilityMqttStatus(), null),
      t('collector health', api.getCollectorHealth(), null),
      t('scheduler', api.getSchedulerStatus(), null),
    ]);
    if (miss.length >= 6) { setLoadError('Admin services unreachable.'); return; }
    setLoadError(null);
    setData({ providers: creds?.providers || [], schedules: schedules || [], rules: rules || [], dlq, mqtt, health: health?.providers || [], scheduler, miss });
    setLastRefresh(new Date());
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh admin" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  if (loadError) return <div className="page-stack"><ErrorState variant="panel" message={loadError} onRetry={load} /></div>;
  if (!data) return <BoneyardSkeleton layout="settings" />;

  return (
    <div className="admin-container page-stack">
      {!canEdit && <Notice note={{ type: 'info', text: 'Read-only: Admin role required to change configuration.' }} />}
      {data.miss.length > 0 && <Notice note={{ type: 'error', text: `Some data failed to load: ${data.miss.join(', ')}.` }} />}
      {active === 'users' && <UsersDirectory canEdit={canEdit} />}
      {active === 'integrations' && <Integrations navigate={navigate} providers={data.providers} health={data.health} verification={verification} setVerification={setVerification} canEdit={canEdit} reload={load} />}
      {active === 'collectors' && <Collectors {...data} canEdit={canEdit} reload={load} />}
      {active === 'rules' && <Rules rules={data.rules} canEdit={canEdit} reload={load} />}
    </div>
  );
};
