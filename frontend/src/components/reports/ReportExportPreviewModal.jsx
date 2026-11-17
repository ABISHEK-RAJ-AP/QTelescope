import React, { useCallback, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, X } from 'lucide-react';
import { fetchApi, BASE_URL } from '../../services/api';
import { rowsToCsv } from '../../lib/csvExport.js';
import { notifyError } from '../../lib/toast.js';
import './ReportExportPreviewModal.css';

const sessionHeaders = () => {
  try {
    const raw = localStorage.getItem('quantum_user');
    if (!raw) return {};
    const user = JSON.parse(raw);
    const headers = {};
    if (user?.role) headers['X-User-Role'] = user.role;
    if (user?.token) headers.Authorization = `Bearer ${user.token}`;
    return headers;
  } catch {
    return {};
  }
};

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   reportType: string,
 *   reportTitle: string,
 *   format: string,
 *   scope: string,
 *   rowCount: number|null,
 *   onExported?: (meta: object) => void,
 * }} props
 */
export function ReportExportPreviewModal({
  open,
  onClose,
  reportType,
  reportTitle,
  format,
  scope,
  rowCount,
  onExported,
}) {
  const titleId = useId();
  const [opts, setOpts] = useState({
    includeSummary: true,
    includeCharts: true,
    includeTable: true,
    includeGlossary: true,
  });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const buildPreviewUrl = useCallback(() => {
    const q = new URLSearchParams({
      report_type: reportType,
      format: format === 'html' ? 'html' : 'json',
      limit: '25',
      include_charts: opts.includeCharts ? 'true' : 'false',
      include_summary: opts.includeSummary ? 'true' : 'false',
      include_table: opts.includeTable ? 'true' : 'false',
      include_glossary: opts.includeGlossary ? 'true' : 'false',
    });
    if (scope) q.set('backend_id', scope);
    return `/reports/preview?${q.toString()}`;
  }, [reportType, format, scope, opts]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchApi(buildPreviewUrl())
      .then((body) => { if (!cancelled) setPreview(body); })
      .catch((e) => { if (!cancelled) setPreview({ error: e?.message || String(e) }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, buildPreviewUrl]);

  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (e.key === 'Escape' && !exporting) onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, exporting, onClose]);

  const saveBlob = (name, text, mime) => {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runExport = async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const scopeLabel = scope || 'fleet';
    setExporting(true);
    try {
      if (format === 'html') {
        const q = new URLSearchParams({
          report_type: reportType,
          format: 'html',
          include_charts: opts.includeCharts ? 'true' : 'false',
          include_summary: opts.includeSummary ? 'true' : 'false',
          include_glossary: opts.includeGlossary ? 'true' : 'false',
        });
        if (scope) q.set('backend_id', scope);
        const res = await fetch(`${BASE_URL}/reports/export?${q.toString()}`, { headers: sessionHeaders() });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const text = await res.text();
        saveBlob(`${reportType}_${scopeLabel}_${stamp}.html`, text, 'text/html');
        onExported?.({ rows: preview?.row_count ?? rowCount, size: text.length, format: 'HTML' });
      } else {
        const q = new URLSearchParams({ report_type: reportType, format: 'json' });
        if (scope) q.set('backend_id', scope);
        const fresh = await fetchApi(`/reports/export?${q.toString()}`);
        const out = fresh?.records || [];
        if (!out.length) throw new Error('No records for this scope — nothing to export.');
        const text = format === 'csv'
          ? rowsToCsv(out)
          : JSON.stringify({
            kind: reportType,
            scope: scopeLabel,
            exported_at: new Date().toISOString(),
            aggregates: fresh.aggregates,
            records: out,
          }, null, 2);
        saveBlob(`${reportType}_${scopeLabel}_${stamp}.${format}`, text, format === 'csv' ? 'text/csv' : 'application/json');
        onExported?.({ rows: out.length, size: text.length, format: format.toUpperCase() });
      }
      onClose();
    } catch (e) {
      notifyError(e?.message || String(e));
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  const previewCols = preview?.fieldnames?.length
    ? preview.fieldnames
    : (preview?.records?.[0] ? Object.keys(preview.records[0]) : []);

  return createPortal(
    <div className="rp-preview-modal-backdrop" role="presentation" onClick={() => !exporting && onClose()}>
      <div
        className="rp-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="rp-preview-modal__head">
          <h2 id={titleId}>Export preview — {reportTitle}</h2>
          <button type="button" className="rp-preview-modal__close" onClick={onClose} disabled={exporting} aria-label="Close preview">
            <X size={18} />
          </button>
        </header>
        <p className="rp-preview-modal__meta">
          Format <strong>{format.toUpperCase()}</strong>
          {' · '}
          Scope <strong>{scope || 'Fleet'}</strong>
          {' · '}
          Rows <strong>{preview?.row_count ?? rowCount ?? '—'}</strong>
        </p>

        <fieldset className="rp-preview-modal__opts">
          <legend>Include in export</legend>
          <label><input type="checkbox" checked={opts.includeSummary} onChange={(e) => setOpts((o) => ({ ...o, includeSummary: e.target.checked }))} /> Summary KPIs</label>
          <label><input type="checkbox" checked={opts.includeCharts} onChange={(e) => setOpts((o) => ({ ...o, includeCharts: e.target.checked }))} /> Charts</label>
          <label><input type="checkbox" checked={opts.includeTable} onChange={(e) => setOpts((o) => ({ ...o, includeTable: e.target.checked }))} /> Data table</label>
          <label><input type="checkbox" checked={opts.includeGlossary} onChange={(e) => setOpts((o) => ({ ...o, includeGlossary: e.target.checked }))} disabled={format !== 'html'} /> Column glossary (HTML)</label>
        </fieldset>

        <div className="rp-preview-modal__body" aria-busy={loading}>
          {loading && <p className="rp-preview-modal__hint"><Loader2 size={14} className="rp-spin" /> Loading preview…</p>}
          {!loading && preview?.error && <p className="rp-err" role="alert">{preview.error}</p>}
          {!loading && !preview?.error && format === 'html' && preview?.html && (
            <iframe title="Report HTML preview" className="rp-preview-modal__iframe" sandbox="allow-same-origin" srcDoc={preview.html} />
          )}
          {!loading && !preview?.error && format !== 'html' && preview?.records && (
            <div className="table-container rp-preview-modal__table">
              <table className="custom-table">
                <thead><tr>{previewCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {preview.records.length === 0 ? (
                    <tr><td colSpan={Math.max(previewCols.length, 1)}>No rows in preview slice.</td></tr>
                  ) : preview.records.map((r, i) => (
                    <tr key={i}>{previewCols.map((c) => <td key={c}>{String(r[c] ?? '—')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && preview?.aggregates && (
            <dl className="rp-preview-modal__agg">
              {Object.entries(preview.aggregates).filter(([k]) => !k.endsWith('_breakdown')).map(([k, v]) => (
                <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{String(v)}</dd></div>
              ))}
            </dl>
          )}
        </div>

        <footer className="rp-preview-modal__actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={exporting}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={runExport} disabled={exporting || loading || rowCount === 0}>
            {exporting ? <><Loader2 size={14} className="rp-spin" /> Exporting…</> : <><Download size={14} /> Download export</>}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}