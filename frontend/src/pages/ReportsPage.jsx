import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Copy, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { notifyError, notifySuccess } from '../lib/toast.js';
import { unableToLoad } from '../constants/messages.js';
import { api, fetchApi } from '../services/api';
import { formatIST } from '../utils/time';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { DetailDrawer } from '../components/observability/DetailDrawer.jsx';
import {
  DetailModalBody,
  DetailModalSection,
  DetailModalDl,
  DetailModalRow,
  DetailModalProvenance,
} from '../components/observability/DetailModalLayout.jsx';
import { EmptyState, TableEmpty } from '../components/observability/EmptyState.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { rowsToCsv } from '../lib/csvExport.js';
import './ReportsPage.css';

const REPORTS = [
  { type: 'backend_monitoring', title: 'Backend inventory', body: 'Operational status, qubit counts, provider, quantum volume.', fields: 'backend_id, name, provider, type, qubits, status, QV', scopeKey: (r) => r.backend_id },
  { type: 'calibration', title: 'Calibration freshness', body: 'Snapshot age, freshness class, calibration identifiers.', fields: 'backend_id, calibration_id, age_hours, freshness, timestamp', scopeKey: (r) => r.backend_id },
  { type: 'alerts', title: 'Alert log', body: 'Every stored alert: severity, resource, status, detection time.', fields: 'alert_id, resource, type, severity, status, detected_at', scopeKey: (r) => r.resource, prefix: true },
];
const FORMATS = [
  { id: 'csv', label: 'CSV', hint: 'Spreadsheet-ready' },
  { id: 'json', label: 'JSON', hint: 'Machine-readable' },
  { id: 'html', label: 'HTML', hint: 'Printable view, fleet only' },
];

const saveBlob = (name, text, mime) => {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};
const kb = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
const short = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-4)}` : '—');

export const ReportsPage = () => {
  const { setActions, clearActions } = usePageActions();
  const [loading, setLoading] = useState(true);
  const [backends, setBackends] = useState([]);
  const [data, setData] = useState({}); // report type -> records | null on failure
  const [snapshots, setSnapshots] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const [type, setType] = useState('alerts');
  const [scope, setScope] = useState('');
  const [format, setFormat] = useState('csv');
  const [exp, setExp] = useState({ state: 'idle' });
  const [history, setHistory] = useState([]);

  const [snapScope, setSnapScope] = useState('');
  const [snapLabel, setSnapLabel] = useState('');
  const [snapBusy, setSnapBusy] = useState(false);
  const [manifest, setManifest] = useState(null); // {snap, state, body}

  const load = useCallback(() => {
    Promise.all([
      api.getBackends().catch(() => []),
      ...REPORTS.map((r) => fetchApi(`/reports/export?report_type=${r.type}&format=json`).then((d) => d?.records || []).catch(() => null)),
      api.listEvidenceSnapshots().catch(() => null),
    ]).then(([b, ...rest]) => {
      setBackends(b || []);
      setData(Object.fromEntries(REPORTS.map((r, i) => [r.type, rest[i]])));
      setSnapshots(rest[REPORTS.length]);
      setLastRefresh(new Date());
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh reports data" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);
  useEffect(() => { if (scope && format === 'html') setFormat('csv'); }, [scope, format]);

  const report = REPORTS.find((r) => r.type === type);
  const scoped = useCallback((r) => {
    const rows = data[r.type];
    if (!rows) return null;
    if (!scope) return rows;
    return rows.filter((x) => (r.prefix ? String(r.scopeKey(x) || '').startsWith(`${scope}_`) : r.scopeKey(x) === scope));
  }, [data, scope]);
  const rows = useMemo(() => scoped(report), [scoped, report]);

  const doExport = async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const scopeLabel = scope || 'fleet';
    const entry = { at: new Date(), report: report.title, scope: scopeLabel, format: format.toUpperCase() };
    setExp({ state: 'working' });
    try {
      let count; let size;
      if (format === 'html') {
        const res = await fetch(api.exportReport(type, 'html'));
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const text = await res.text();
        count = data[type]?.length ?? null; size = text.length;
        saveBlob(`${type}_${stamp}.html`, text, 'text/html');
      } else {
        const fresh = await fetchApi(`/reports/export?report_type=${type}&format=json`);
        const all = fresh?.records || [];
        const out = scope ? all.filter((x) => (report.prefix ? String(report.scopeKey(x) || '').startsWith(`${scope}_`) : report.scopeKey(x) === scope)) : all;
        if (!out.length) throw new Error('No records for this scope — nothing to export.');
        const text = format === 'csv' ? rowsToCsv(out) : JSON.stringify({ kind: type, scope: scopeLabel, exported_at: new Date().toISOString(), records: out }, null, 2);
        count = out.length; size = text.length;
        saveBlob(`${type}_${scopeLabel}_${stamp}.${format}`, text, format === 'csv' ? 'text/csv' : 'application/json');
      }
      const done = { ...entry, state: 'ok', rows: count, size };
      setHistory((h) => [done, ...h].slice(0, 8));
      setExp({ state: 'ok', ...done });
      notifySuccess(`Exported ${count ?? '—'} rows (${format.toUpperCase()}).`);
    } catch (e) {
      const fail = { ...entry, state: 'err', error: e?.message || String(e) };
      setHistory((h) => [fail, ...h].slice(0, 8));
      setExp({ state: 'err', ...fail });
      notifyError(fail.error);
    }
  };

  const createSnapshot = async () => {
    setSnapBusy(true);
    try {
      const rec = await api.createEvidenceSnapshot({
        backend_id: snapScope || null,
        label: snapLabel.trim() || (snapScope ? `Evidence ${snapScope}` : 'Fleet evidence'),
        include_alerts: true, include_incidents: true, include_calibration: true, include_qubit_summary: true,
      });
      notifySuccess(`Snapshot ${rec.snapshot_id} created · SHA-256 ${short(rec.package_sha256)}`);
      setSnapshots(await api.listEvidenceSnapshots());
      setSnapLabel('');
    } catch (e) {
      notifyError(`Snapshot failed: ${e?.message || e}`);
    } finally {
      setSnapBusy(false);
    }
  };

  const copy = (h) => navigator.clipboard?.writeText(h).then(
    () => notifySuccess('Hash copied to clipboard.'),
    () => notifyError('Clipboard unavailable; select the hash in the drawer instead.'),
  );
  const download = (s) => api.downloadEvidenceSnapshotBlob(s.snapshot_id).then(
    () => notifySuccess(`Downloaded ${s.snapshot_id}.zip`),
    (e) => notifyError(e.message),
  );
  const openManifest = (snap) => {
    setManifest({ snap, state: 'loading' });
    fetchApi(`/evidence/snapshots/${snap.snapshot_id}/manifest`)
      .then((body) => setManifest({ snap, state: 'ok', body }))
      .catch((e) => setManifest({ snap, state: 'err', body: e?.message || String(e) }));
  };

  if (loading) return <BoneyardSkeleton layout="grid" />;

  const previewCols = rows?.[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="page-stack rp">
      <section className="card rp-card" aria-labelledby="rp-export-h" data-tour="page-reports-export">
        <h3 id="rp-export-h" className="rp-h">Export a report</h3>
        <div className="rp-export">
          <div>
            <div className="rp-label" id="rp-type-l">Report</div>
            <div className="rp-catalog" role="radiogroup" aria-labelledby="rp-type-l">
              {REPORTS.map((r) => {
                const n = scoped(r)?.length;
                return (
                  <button key={r.type} type="button" role="radio" aria-checked={type === r.type} className="rp-report" onClick={() => setType(r.type)}>
                    <span className="rp-report__top"><FileText size={15} aria-hidden /> <b>{r.title}</b>
                      <span className="rp-report__n">{n == null ? 'unavailable' : `${n} rows`}</span></span>
                    <span className="rp-report__body">{r.body}</span>
                    <span className="rp-report__fields">{r.fields}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rp-opts">
            <label className="rp-label">Scope
              <select className="input-control" value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="">Fleet (all backends)</option>
                {backends.map((b) => <option key={b.backend_id} value={b.backend_id}>{b.backend_name || b.backend_id}</option>)}
              </select>
            </label>
            <div>
              <div className="rp-label" id="rp-fmt-l">Format</div>
              <div className="rp-formats" role="radiogroup" aria-labelledby="rp-fmt-l">
                {FORMATS.map((f) => {
                  const off = f.id === 'html' && !!scope;
                  return (
                    <button key={f.id} type="button" role="radio" aria-checked={format === f.id} disabled={off} className="rp-fmt" onClick={() => setFormat(f.id)} title={off ? 'HTML export is fleet-wide only; choose CSV or JSON for a backend scope.' : f.hint}>
                      <b>{f.label}</b><small>{f.hint}</small>
                    </button>
                  );
                })}
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={doExport} disabled={exp.state === 'working' || rows == null || (rows?.length === 0 && format !== 'html')}>
              {exp.state === 'working' ? <><Loader2 size={14} className="rp-spin" /> Exporting…</> : <><Download size={14} /> Export {report.title.toLowerCase()}</>}
            </button>
            <div className="rp-status" role="status" aria-live="polite">
              {exp.state === 'idle' && <span className="rp-status__idle">Ready to export.</span>}
              {exp.state === 'ok' && <span className="rp-ok"><CheckCircle2 size={14} aria-hidden /> Exported {exp.rows ?? '?'} rows · {exp.format} · {kb(exp.size)}</span>}
              {exp.state === 'err' && <span className="rp-err"><AlertTriangle size={14} aria-hidden /> Failed: {exp.error}</span>}
            </div>
          </div>
        </div>

        <div className="rp-preview">
          <div className="rp-label">Preview (first 5 of {rows?.length ?? 0})</div>
          {rows == null ? <EmptyState variant="inline" compact align="start" title="Report unavailable" message="Export failed. Use Refresh and try again." />
            : rows.length === 0 ? <EmptyState variant="inline" compact align="start" title="No rows" message={scope ? `No ${report.title.toLowerCase()} rows for ${scope}.` : 'No rows for this report type yet.'} />
              : (
                <div className="table-container">
                  <table className="custom-table"><thead><tr>{previewCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i}>{previewCols.map((c) => <td key={c}>{String(r[c] ?? '—')}</td>)}</tr>)}</tbody></table>
                </div>
              )}
        </div>

        {history.length > 0 && (
          <div className="rp-preview">
            <div className="rp-label">Exports this session</div>
            <div className="table-container">
              <table className="custom-table">
                <thead><tr><th>Time (IST)</th><th>Report</th><th>Scope</th><th>Format</th><th>Rows</th><th>Size</th><th>Result</th></tr></thead>
                <tbody>{history.map((h, i) => (
                  <tr key={i}><td>{formatIST(h.at)}</td><td>{h.report}</td><td>{h.scope}</td><td>{h.format}</td><td>{h.rows ?? '—'}</td><td>{h.size ? kb(h.size) : '—'}</td>
                    <td>{h.state === 'ok' ? '✓ Done' : `✕ ${h.error}`}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="card rp-card" aria-labelledby="rp-ev-h" data-tour="page-evidence">
        <h3 id="rp-ev-h" className="rp-h">Evidence snapshots</h3>
        <p className="rp-desc rp-desc--compact">Immutable ZIP with SHA-256 manifest. Fleet or single-backend scope.</p>
        <div className="rp-snaprow">
          <label className="rp-label">Scope
            <select className="input-control" value={snapScope} onChange={(e) => setSnapScope(e.target.value)}>
              <option value="">Fleet (all backends)</option>
              {backends.map((b) => <option key={b.backend_id} value={b.backend_id}>{b.backend_name || b.backend_id}</option>)}
            </select>
          </label>
          <label className="rp-label rp-grow">Label (optional)
            <input className="input-control" value={snapLabel} onChange={(e) => setSnapLabel(e.target.value)} placeholder="e.g. Pre-maintenance state" />
          </label>
          <button type="button" className="btn btn-primary" disabled={snapBusy} onClick={createSnapshot}>
            {snapBusy ? <><Loader2 size={14} className="rp-spin" /> Building…</> : 'Generate snapshot'}
          </button>
        </div>
        <div className="table-container">
          <table className="custom-table">
            <thead><tr><th>Created (IST)</th><th>Label</th><th>Scope</th><th>Period</th><th>By</th><th>Manifest SHA-256</th><th>Package SHA-256</th><th>Actions</th></tr></thead>
            <tbody>
              {snapshots == null ? (
                <TableEmpty colSpan={8} title="History unavailable" message={`${unableToLoad('evidence history', 'Use Refresh.')}`} />
              ) : snapshots.length === 0 ? (
                <TableEmpty colSpan={8} title="No snapshots" message="Generate a snapshot above; entries appear here with checksums." />
              ) : snapshots.map((s) => (
                <tr key={s.snapshot_id}>
                  <td className="rp-nowrap">{formatIST(s.created_at, false)}</td>
                  <td>{s.label || '—'}<div className="rp-mono">{s.snapshot_id}</div></td>
                  <td>{s.scope_backend_id || 'Fleet'}</td>
                  <td className="rp-nowrap">{s.period_start ? `${formatIST(s.period_start, false)} → ${formatIST(s.period_end, false)}` : 'All stored data'}</td>
                  <td>{s.created_by || '—'}</td>
                  <td><span className="rp-mono" title={s.manifest_sha256}>{short(s.manifest_sha256)}</span> <button type="button" className="rp-copy" aria-label={`Copy manifest hash of ${s.snapshot_id}`} onClick={() => copy(s.manifest_sha256)}><Copy size={12} /></button></td>
                  <td><span className="rp-mono" title={s.package_sha256}>{short(s.package_sha256)}</span> <button type="button" className="rp-copy" aria-label={`Copy package hash of ${s.snapshot_id}`} onClick={() => copy(s.package_sha256)}><Copy size={12} /></button></td>
                  <td><div className="rp-btns">
                    <button type="button" className="btn btn-secondary btn--xs" onClick={() => openManifest(s)}>Provenance</button>
                    <button type="button" className="btn btn-secondary btn--xs" onClick={() => download(s)}>ZIP</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <DetailDrawer
        open={!!manifest}
        onClose={() => setManifest(null)}
        title={manifest ? manifest.snap.snapshot_id : 'Snapshot provenance'}
        subtitle={manifest ? `Created ${formatIST(manifest.snap.created_at)}` : undefined}
        size="lg"
      >
        {manifest && (
          <DetailModalBody>
            <DetailModalSection title="Details">
              <DetailModalDl className="rp-dl">
                <DetailModalRow label="Created">{formatIST(manifest.snap.created_at)} by {manifest.snap.created_by || '—'}</DetailModalRow>
                <DetailModalRow label="Scope">{manifest.snap.scope_backend_id || 'Fleet'}</DetailModalRow>
                <DetailModalRow label="Manifest SHA-256"><span className="rp-mono rp-break">{manifest.snap.manifest_sha256}</span></DetailModalRow>
                <DetailModalRow label="Package SHA-256"><span className="rp-mono rp-break">{manifest.snap.package_sha256}</span></DetailModalRow>
              </DetailModalDl>
              <DetailModalProvenance>Verify a downloaded ZIP with <code>sha256sum {manifest.snap.snapshot_id}.zip</code> and compare to the package hash.</DetailModalProvenance>
            </DetailModalSection>
            <DetailModalSection title="manifest.json">
              {manifest.state === 'loading' && <p className="page-hint">Loading manifest…</p>}
              {manifest.state === 'err' && <p className="rp-err" role="alert">Could not read manifest: {manifest.body}</p>}
              {manifest.state === 'ok' && <pre className="rp-pre">{JSON.stringify(manifest.body, null, 2)}</pre>}
              <button type="button" className="btn btn-secondary" style={{ marginTop: 10 }} onClick={() => download(manifest.snap)}>Download ZIP</button>
            </DetailModalSection>
          </DetailModalBody>
        )}
      </DetailDrawer>

    </div>
  );
};
