import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { CollapsibleSection } from '../components/observability/CollapsibleSection.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { summarizeOperatorError } from '../utils/operatorFault.js';
import './AdministrationPage.css';

const TEST_RULE_ID = /^e2e_rule_/i;
const TEST_USER = /^(chg_|mail_|mfa_|e2e_)/i;

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
    return ['SuperAdmin', 'Admin', 'PlatformAdmin', 'QuantumOpsAdmin', 'SecurityAdmin'].includes(u?.role);
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
  const [editProvider, setEditProvider] = useState(null);
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
              Live adapters poll telemetry. Run verification after saving credentials on the server.
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

      {ldap?.enabled && (
        <div className="card admin-pad" style={{ marginBottom: 14 }}>
          <h3 className="admin-card-title">Directory login (LDAP)</h3>
          <p className="page-hint">
            Bind against <strong>{ldap.host}</strong> ({ldap.mode}
            {ldap.library ? '' : ' — ldap3 missing'}). Default role {ldap.default_role}. Local accounts tried first.
          </p>
        </div>
      )}

      <div className="card" style={{ padding: 0 }} data-tour="page-admin-providers">
        <div className="table-container" style={{ border: 'none' }}>
          <table className="custom-table admin-table">
            <thead>
              <tr>
                <th>Provider</th><th>Adapter</th><th>Credentials</th><th>Connection</th><th>Telemetry</th><th style={{ textAlign: 'right' }}>Configure</th>
              </tr>
            </thead>
            <tbody>
              {providers.filter((p) => p.adapter === 'live' || p.adapter_status === 'LIVE').map((p) => {
                const live = p.adapter === 'live' || p.adapter_status === 'LIVE';
                const v = verBy[p.id];
                const h = healthBy[p.id];
                const flowing = h?.last_success_at ? Date.now() - new Date(h.last_success_at).getTime() < FRESH_MS : (h ? false : null);
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
                        <Stage ok={flowing} label={flowing ? 'Flowing' : h ? 'Stale / failing' : 'No runs'} title={h ? `Last run ${fmtTime(h.last_run_at)} · last success ${fmtTime(h.last_success_at)}` : 'No collector run recorded'} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className="btn btn-secondary btn--xs" onClick={() => setEditProvider(p)} disabled={!canEdit} title={reason}>
                          <Pencil size={12} /> Edit
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editProvider && (
        <Modal title={`Configure ${editProvider.name}`} onClose={() => { setEditProvider(null); cancel(editProvider); }}
          footer={(
            <>
              <button type="button" className="btn btn-secondary" onClick={() => { setEditProvider(null); cancel(editProvider); }}>Close</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canEdit || !dirty(editProvider) || Object.keys(errors(editProvider)).length > 0 || fb[editProvider.id]?.text === 'Saving…'}
                onClick={() => setConfirm(editProvider.id)}
              >
                <Save size={14} /> Save credentials
              </button>
            </>
          )}
        >
          <form className="admin-cred-form" onSubmit={(e) => { e.preventDefault(); if (!Object.keys(errors(editProvider)).length) setConfirm(editProvider.id); }}>
            <p className="page-hint" style={{ margin: 0 }}>
              {editProvider.truth_help} Leave secrets blank to keep stored values.
              {(editProvider.adapter === 'live' || editProvider.adapter_status === 'LIVE')
                ? ' Saving runs a live check and collection pass.'
                : ' Stub providers store credentials only.'}
            </p>
            <div className="admin-cred-fields">
              {editProvider.fields.map((f) => {
                const err = dirty(editProvider) ? errors(editProvider)[f.key] : null;
                return (
                  <label key={f.key} className="admin-field">
                    <span className="admin-input-label">{f.label}{f.required === false ? ' (optional)' : ''}</span>
                    <span className="admin-input-wrapper">
                      <input
                        type={f.secret && !reveal[`${editProvider.id}.${f.key}`] ? 'password' : 'text'}
                        className="input-control admin-input-field"
                        value={fieldVal(editProvider, f)}
                        placeholder={f.secret && editProvider.is_configured ? '•••••••• (saved)' : f.label}
                        autoComplete="off"
                        disabled={!canEdit}
                        aria-invalid={!!err}
                        onChange={(e) => setField(editProvider, f, e.target.value)}
                      />
                      {f.secret && (
                        <button type="button" className="admin-input-toggle-btn" aria-label="Toggle visibility" onClick={() => setReveal((r) => ({ ...r, [`${editProvider.id}.${f.key}`]: !r[`${editProvider.id}.${f.key}`] }))}>
                          {reveal[`${editProvider.id}.${f.key}`] ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      )}
                    </span>
                    {err && <span className="admin-field-error">{err}</span>}
                  </label>
                );
              })}
            </div>
            <Notice note={fb[editProvider.id]} />
          </form>
        </Modal>
      )}

      {confirm && (
        <Modal title="Save credentials" onClose={() => setConfirm(null)}
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={() => { save(providers.find((x) => x.id === confirm)); setEditProvider(null); }}>Save credentials</button></>}>
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
  const [dlqDetail, setDlqDetail] = useState(null);
  const [edits, setEdits] = useState({}); // category -> {interval, enabled}
  const [fb, setFb] = useState({});
  const [runNote, setRunNote] = useState(null);
  const [running, setRunning] = useState(false);
  const [purgingDlq, setPurgingDlq] = useState(false);
  const [collectorConfirm, setCollectorConfirm] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [qualityReports, setQualityReports] = useState([]);
  const [telemetryApiErr, setTelemetryApiErr] = useState('');
  const reason = canEdit ? undefined : 'Admin role required';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ex, iq] = await Promise.all([
          api.getCollectorExecutions({ limit: 50 }),
          api.getIngestionQuality(25),
        ]);
        if (!cancelled) {
          setExecutions(ex?.executions || []);
          setQualityReports(iq?.reports || []);
          setTelemetryApiErr('');
        }
      } catch (e) {
        if (!cancelled) {
          setExecutions([]);
          setQualityReports([]);
          const status = e?.status;
          setTelemetryApiErr(
            status === 404
              ? 'Collector history APIs missing on this API build — restart the backend from the latest repo (admin collector-executions / ingestion-quality).'
              : (e?.message || 'Could not load collector telemetry tables.'),
          );
        }
      }
    })();
    return () => { cancelled = true; };
  }, [health, dlq, reload]);

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
  const save = async (s, snapshot) => {
    const c = snapshot ?? cur(s);
    if (intervalErr(s)) return;
    try {
      await api.updateSchedule({ category: s.category, interval_seconds: Number(c.interval), enabled: c.enabled });
      setEdits((e) => { const n = { ...e }; delete n[s.category]; return n; });
      setFb((f) => ({ ...f, [s.category]: { type: 'success', text: 'Saved' } }));
      await reload();
    } catch (e) { setFb((f) => ({ ...f, [s.category]: { type: 'error', text: errText(e) } })); }
  };

  const onEnabledChange = (s, v) => {
    const next = { ...cur(s), enabled: v };
    patch(s, { enabled: v });
    if (canEdit) save(s, next);
  };

  const onIntervalBlur = (s) => {
    if (!canEdit || !isDirty(s) || intervalErr(s)) return;
    save(s);
  };
  const failures = dlq?.failures || [];

  return (
    <>
      <div className="card" style={{ padding: 0 }} data-tour="page-admin-collectors">
        <div className="admin-pad admin-actions" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3 className="admin-card-title" style={{ marginBottom: 4 }}>Collection schedules</h3>
            <p className="admin-sub">
              {scheduler?.driver_label || 'Collection driver'} · {scheduler?.enabled ? 'running' : 'idle'}
              {scheduler?.tick_seconds ? ` · tick ${scheduler.tick_seconds}s` : ''}
              . Intervals auto-save on blur.
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn--xs" disabled={!canEdit || running} title={reason} onClick={() => setCollectorConfirm('run')}>
            {running ? 'Collecting…' : 'Run collection now'}
          </button>
        </div>
        <Notice note={runNote} />
        <div className="table-container" style={{ border: 'none' }}>
          <table className="custom-table admin-table">
            <thead><tr><th>Category</th><th>Interval (s)</th><th>Enabled</th><th>Last run</th><th>Status</th></tr></thead>
            <tbody>
              {schedules.map((s) => {
                const c = cur(s);
                const err = isDirty(s) ? intervalErr(s) : null;
                const last = scheduler?.schedules?.find((x) => x.category === s.category)?.last_run;
                return (
                  <tr key={s.category}>
                    <td><strong>{s.category}</strong></td>
                    <td>
                      <input
                        type="number"
                        min="10"
                        max="86400"
                        className="input-control admin-num"
                        value={c.interval}
                        disabled={!canEdit}
                        aria-invalid={!!err}
                        onChange={(e) => patch(s, { interval: e.target.value })}
                        onBlur={() => onIntervalBlur(s)}
                      />
                      {err && <div className="admin-field-error">{err}</div>}
                    </td>
                    <td>
                      <Toggle checked={c.enabled} disabled={!canEdit} label={c.enabled ? 'On' : 'Off'} onChange={(v) => onEnabledChange(s, v)} />
                    </td>
                    <td className="admin-sub">{fmtTime(last)}</td>
                    <td className="admin-sub">
                      {isDirty(s) && !err ? <span className="admin-dirty">Pending…</span> : null}
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

      {telemetryApiErr && (
        <Notice note={{ type: 'error', text: telemetryApiErr }} />
      )}

      <div className="card" style={{ padding: 0 }}>
        <h3 className="admin-card-title admin-pad">Run history (30-day window, newest 50)</h3>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="custom-table admin-table">
            <thead><tr><th>Time</th><th>Provider</th><th>Trigger</th><th>Status</th><th>Backends</th><th>Duration</th><th>Lineage</th></tr></thead>
            <tbody>
              {executions.map((e) => (
                <tr key={e.execution_id}>
                  <td className="admin-sub">{fmtTime(e.timestamp)}</td>
                  <td>{e.provider_id}</td>
                  <td className="admin-sub">{e.trigger_type || 'scheduled'}</td>
                  <td><Stage ok={e.status === 'OK'} label={e.status} /></td>
                  <td>{e.backends_detected ?? '—'}</td>
                  <td>{e.duration_ms != null ? `${e.duration_ms} ms` : '—'}</td>
                  <td className="admin-sub">{e.lineage && !/simulat|mock/i.test(e.lineage) ? e.lineage : '—'}</td>
                </tr>
              ))}
              {executions.length === 0 && <TableEmpty colSpan={7} title="No execution history" message="Runs are recorded after discovery or scheduled collection." />}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <h3 className="admin-card-title admin-pad">Ingestion quality (recent)</h3>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="custom-table admin-table">
            <thead><tr><th>Time</th><th>Provider</th><th>Outcome</th><th>Completeness</th><th>Backends</th><th>Telemetry rows</th></tr></thead>
            <tbody>
              {qualityReports.map((r) => (
                <tr key={r.report_id}>
                  <td className="admin-sub">{fmtTime(r.timestamp)}</td>
                  <td>{r.provider_id}</td>
                  <td>{r.quality_outcome || r.status}</td>
                  <td>{r.completeness_pct != null ? `${r.completeness_pct}%` : '—'}</td>
                  <td>{r.received_backends ?? '—'}</td>
                  <td>{r.backend_telemetry_rows ?? '—'}</td>
                </tr>
              ))}
              {qualityReports.length === 0 && <TableEmpty colSpan={6} title="No quality reports" message="Quality snapshots appear after collector runs." />}
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
              {failures.map((f) => {
                const summary = summarizeOperatorError(f.error) || '—';
                const hasRaw = f.error && summary !== String(f.error).trim();
                return (
                  <tr key={f.id}>
                    <td className="admin-sub">{fmtTime(f.at)}</td>
                    <td>{f.provider_id}</td>
                    <td>{f.status}</td>
                    <td className="admin-err-cell">
                      <span>{summary}</span>
                      {hasRaw ? (
                        <button type="button" className="btn btn-secondary btn--xs" style={{ marginLeft: 8 }} onClick={() => setDlqDetail(f)}>
                          View details
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {failures.length === 0 && <TableEmpty colSpan={4} title="Dead-letter queue empty" message="No collector failures in the DLQ." />}
            </tbody>
          </table>
        </div>
        <div className="admin-pad admin-actions" style={{ paddingTop: 0 }}>
          <button type="button" className="btn btn-secondary" disabled={!canEdit || purgingDlq || failures.length === 0} title={reason} onClick={() => setCollectorConfirm('purge')}>
            {purgingDlq ? 'Clearing…' : 'Clear DLQ history'}
          </button>
          <span className="admin-sub">Removes stored failure records on this server. Does not replay collection jobs.</span>
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
      {dlqDetail ? (
        <ConfirmDialog
          dlg={{
            title: `Collector failure · ${dlqDetail.provider_id}`,
            body: dlqDetail.error || 'No detail recorded.',
            confirm: 'Close',
            onConfirm: () => setDlqDetail(null),
          }}
          busy={false}
          onCancel={() => setDlqDetail(null)}
        />
      ) : null}
    </>
  );
}

/* ------------------------------- Rules ------------------------------- */
function Rules({ rules, canEdit, reload }) {
  const [showTestRules, setShowTestRules] = useState(false);
  const testRuleCount = useMemo(() => rules.filter((r) => TEST_RULE_ID.test(r.rule_id)).length, [rules]);
  const [purgeTestAsk, setPurgeTestAsk] = useState(false);
  const [purgingTest, setPurgingTest] = useState(false);
  const visibleRules = useMemo(
    () => (showTestRules ? rules : rules.filter((r) => !TEST_RULE_ID.test(r.rule_id))),
    [rules, showTestRules],
  );
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

  const purgeTestRules = async () => {
    const ids = rules.filter((r) => TEST_RULE_ID.test(r.rule_id)).map((r) => r.rule_id);
    if (!ids.length) return;
    setPurgingTest(true);
    try {
      const res = await Promise.allSettled(ids.map((id) => api.deleteAlertRule(id)));
      const ok = res.filter((r) => r.status === 'fulfilled').length;
      setNote({ type: 'success', text: `Removed ${ok} test rule${ok === 1 ? '' : 's'}.` });
      await reload();
    } catch (er) {
      setNote({ type: 'error', text: `Purge failed: ${errText(er)}` });
    } finally {
      setPurgingTest(false);
      setPurgeTestAsk(false);
    }
  };

  return (
    <>
      <div className="card" style={{ padding: 0 }} data-tour="page-admin-rules">
        <div className="admin-card-header-actions admin-pad">
          <div>
            <h3 className="admin-card-title" style={{ marginBottom: 2 }}>Alert rules</h3>
            <p className="page-hint" style={{ margin: 0 }}>Threshold rules evaluated against backend telemetry.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {testRuleCount > 0 && (
              <>
                <label className="admin-sub" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={showTestRules} onChange={(e) => setShowTestRules(e.target.checked)} />
                  Show test rules ({testRuleCount} hidden)
                </label>
                <button
                  type="button"
                  className="btn btn-secondary btn--xs"
                  disabled={!canEdit || purgingTest}
                  onClick={() => setPurgeTestAsk(true)}
                >
                  Delete test rules
                </button>
              </>
            )}
            <button type="button" className="btn btn-primary" disabled={!canEdit} title={reason} onClick={() => open(null)}><Plus size={14} /> Add rule</button>
          </div>
        </div>
        <div className="admin-pad" style={{ paddingTop: 0 }}><Notice note={note} /></div>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="custom-table admin-table">
            <thead><tr><th>Rule</th><th>Condition</th><th>Severity</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {visibleRules.map((r) => (
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
      {purgeTestAsk && (
        <ConfirmDialog
          danger
          dlg={{
            title: `Delete ${testRuleCount} test rule${testRuleCount === 1 ? '' : 's'}?`,
            body: 'Removes e2e_rule_* automation rules from this deployment.',
            confirm: 'Delete test rules',
            onConfirm: purgeTestRules,
          }}
          busy={purgingTest}
          onCancel={() => !purgingTest && setPurgeTestAsk(false)}
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
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sortKey, setSortKey] = useState('username');
  const [showTestAccounts, setShowTestAccounts] = useState(false);
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
    const prev = rows;
    setRows((list) => list.map((u) => (u.username === username ? { ...u, role } : u)));
    try {
      await api.assignUserRole(username, role);
    } catch (e) {
      setRows(prev);
      setErr(errText(e));
    } finally {
      setBusy(null);
    }
  };

  const roleOptions = useMemo(() => {
    const seen = new Set();
    return (roles || []).filter((r) => {
      const id = r.id || r.role;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [roles]);

  const visible = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    let list = showTestAccounts ? rows : rows.filter((u) => !TEST_USER.test(u.username || ''));
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
  }, [rows, debouncedSearch, sortKey, showTestAccounts]);
  const hiddenTestUsers = rows.filter((u) => TEST_USER.test(u.username || '')).length;
  useEffect(() => { setPage(1); }, [debouncedSearch, sortKey]);
  const userPages = Math.max(1, Math.ceil(visible.length / USER_PAGE));
  const userPage = Math.min(page, userPages);
  const pageUsers = visible.slice((userPage - 1) * USER_PAGE, userPage * USER_PAGE);

  return (
    <>
      <RoleMatrix canEditAccess={canEdit} />
      <div className="card admin-users" data-tour="page-admin-users">
        <h3 className="admin-card-title">User directory</h3>
        <p className="page-hint">Search accounts and assign roles. Capabilities follow the matrix above.</p>
        {err && <Notice note={{ type: 'error', text: err }} />}
        <div className="admin-users-toolbar">
          <label className="admin-users-search outline-field">
            <span>Search</span>
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
          {hiddenTestUsers > 0 && (
            <label className="admin-sub" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={showTestAccounts} onChange={(e) => setShowTestAccounts(e.target.checked)} />
              Show test accounts ({hiddenTestUsers} hidden)
            </label>
          )}
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
                        {[
                          ...roleOptions,
                          ...(u.role && !roleOptions.some((r) => (r.id || r.role) === u.role)
                            ? [{ id: u.role, label: roleLabel(u.role) }]
                            : []),
                        ].map((r) => (
                          <option key={r.id || r.role} value={r.id || r.role}>{r.label || roleLabel(r.id || r.role) || r.id}</option>
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

/* ----------------------------- Logs explorer ----------------------------- */
function isoWindow(hours, anchorIso) {
  const end = anchorIso ? new Date(anchorIso.includes('Z') ? anchorIso : `${anchorIso}Z`) : new Date();
  const start = new Date(end.getTime() - (Number(hours) || 24) * 3.6e6);
  return { since: start.toISOString(), until: end.toISOString() };
}

const LOG_PAGE = 50;

function AdminAuditLog() {
  const [params] = useSearchParams();
  const [source, setSource] = useState(params.get('source') === 'audit' ? 'audit' : 'app');
  const [q, setQ] = useState(params.get('q') || '');
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [requestId, setRequestId] = useState(params.get('requestId') || '');
  const [backendId, setBackendId] = useState(params.get('backend') || '');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [logPage, setLogPage] = useState(1);

  const search = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      if (source === 'audit') {
        const res = await api.getAuditLog({
          limit: 150,
          q: q.trim() || undefined,
          action: action.trim() || undefined,
          actor: actor.trim() || undefined,
        });
        setRows(res?.events || []);
      } else {
        const { since, until } = isoWindow(params.get('hours') || 24, params.get('at') || undefined);
        const res = await api.getAppLogs({
          limit: 150,
          q: q.trim() || undefined,
          requestId: requestId.trim() || undefined,
          backendId: backendId.trim() || undefined,
          since,
          until,
        });
        setRows(res?.events || []);
      }
    } catch (e) {
      const msg = e?.status === 404
        ? 'Application log API not available on this backend — restart API from the latest codebase.'
        : (e?.message || 'Search failed');
      setErr(msg);
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [source, q, action, actor, requestId, backendId, params]);

  useEffect(() => { search(); }, [search]);
  useEffect(() => { setLogPage(1); }, [source, q, action, actor, requestId, backendId]);

  const logPages = Math.max(1, Math.ceil(rows.length / LOG_PAGE));
  const logPg = Math.min(logPage, logPages);
  const pageRows = rows.slice((logPg - 1) * LOG_PAGE, logPg * LOG_PAGE);

  return (
    <div className="card admin-kv-card" data-tour="page-admin-audit-log">
      <h3 className="admin-card-title">Logs explorer</h3>
      <p className="page-hint" style={{ marginBottom: 12 }}>
        Audit events and structured application logs (collector runs, API correlation). Secrets are redacted at ingest.
      </p>
      <div className="admin-actions" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <label className="outline-field">
          <span>Source</span>
          <select className="input-control" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Log source">
            <option value="app">Application</option>
            <option value="audit">Audit</option>
          </select>
        </label>
        <label className="outline-field">
          <span>Text</span>
          <input className="input-control" placeholder="Message" aria-label="Search text" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {source === 'audit' ? (
          <>
            <label className="outline-field">
              <span>Action</span>
              <input className="input-control" placeholder="Prefix" aria-label="Action prefix" value={action} onChange={(e) => setAction(e.target.value)} />
            </label>
            <label className="outline-field">
              <span>Actor</span>
              <input className="input-control" aria-label="Actor" value={actor} onChange={(e) => setActor(e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label className="outline-field">
              <span>Request</span>
              <input className="input-control" placeholder="ID" aria-label="Request ID" value={requestId} onChange={(e) => setRequestId(e.target.value)} />
            </label>
            <label className="outline-field">
              <span>Backend</span>
              <input className="input-control" placeholder="ID" aria-label="Backend ID" value={backendId} onChange={(e) => setBackendId(e.target.value)} />
            </label>
          </>
        )}
        <button type="button" className="btn btn-primary btn--xs" disabled={busy} onClick={search}>{busy ? 'Loading…' : 'Search'}</button>
      </div>
      {err && <Notice note={{ type: 'error', text: err }} />}
      <div className="table-container" style={{ border: 'none' }}>
        <table className="custom-table admin-table">
          <thead>
            <tr>
              {source === 'audit'
                ? <><th>Time</th><th>Action</th><th>Actor</th><th>Resource</th><th>Detail</th></>
                : <><th>Time</th><th>Severity</th><th>Component</th><th>Request</th><th>Message</th></>}
            </tr>
          </thead>
          <tbody>
            {source === 'audit' ? pageRows.map((ev, i) => (
              <tr key={`${ev.timestamp}-${ev.action}-${i}`}>
                <td className="admin-sub">{fmtTime(ev.timestamp)}</td>
                <td><code>{ev.action}</code></td>
                <td>{ev.actor || '—'}</td>
                <td className="admin-sub">{ev.resource_type ? `${ev.resource_type}:${ev.resource_id || ''}` : '—'}</td>
                <td className="admin-sub admin-err-cell" style={{ maxWidth: 280 }}>{ev.detail && Object.keys(ev.detail).length ? JSON.stringify(ev.detail) : '—'}</td>
              </tr>
            )) : pageRows.map((ev, i) => (
              <tr key={`${ev.timestamp}-${ev.event_code}-${i}`}>
                <td className="admin-sub">{fmtTime(ev.timestamp)}</td>
                <td>{ev.severity}</td>
                <td><code>{ev.component}</code>{ev.provider_id ? <span className="admin-sub"> · {ev.provider_id}</span> : null}</td>
                <td className="admin-sub">{ev.request_id || '—'}</td>
                <td className="admin-sub" style={{ maxWidth: 320 }}>{ev.message}</td>
              </tr>
            ))}
            {rows.length === 0 && !busy && <TableEmpty colSpan={5} title="No events" message="No entries match the filter." />}
          </tbody>
        </table>
      </div>
      {rows.length > LOG_PAGE && (
        <div className="admin-pad">
          <ListPager page={logPg} pages={logPages} onPage={setLogPage} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Page ------------------------------- */
export const AdministrationPage = ({ section = 'integrations', onNavigateSection }) => {
  const navigate = useNavigate();
  const knownSection = new Set([...ADMIN_SECTIONS.map((s) => s.id), 'logs']);
  const active = section === 'hub' ? 'integrations' : (knownSection.has(section) ? section : 'integrations');
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
      {data.miss.length > 0 && <Notice note={{ type: 'error', text: `Could not load ${data.miss.join(', ')}. Refresh the page or open Platform health.` }} />}
      {active === 'users' && <UsersDirectory canEdit={canEdit} />}
      {active === 'integrations' && <Integrations navigate={navigate} providers={data.providers} health={data.health} verification={verification} setVerification={setVerification} canEdit={canEdit} reload={load} />}
      {active === 'collectors' && <Collectors {...data} canEdit={canEdit} reload={load} />}
      {active === 'logs' && <AdminAuditLog />}
      {active === 'rules' && <Rules rules={data.rules} canEdit={canEdit} reload={load} />}
    </div>
  );
};
