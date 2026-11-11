import React from 'react';
import { ExternalLink } from 'lucide-react';
import { DetailDrawer } from '../observability/DetailDrawer.jsx';
import { LineageTag, StateBar, StatusText } from '../../pages/backendCommon.jsx';
import { formatAge, isStale, STALE_MIN } from '../../pages/backendUtils.js';

/** Read-only backend context; preserves inventory filters vs full navigation. */
export function BackendPreviewDrawer({ row, onClose, onOpenWorkspace }) {
  if (!row) return null;
  const total = row.counts
    ? (row.counts.GREEN || 0) + (row.counts.YELLOW || 0) + (row.counts.RED || 0) + (row.counts.UNKNOWN || 0)
    : 0;

  return (
    <DetailDrawer
      open={Boolean(row)}
      title={row.name}
      subtitle={row.id}
      onClose={onClose}
      size="md"
      tourId="backend-preview-drawer"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { onOpenWorkspace?.(row.id); onClose?.(); }}
          >
            <ExternalLink size={15} aria-hidden /> Open workspace
          </button>
        </>
      )}
    >
      <dl className="bk-preview-dl">
        <div><dt>Status</dt><dd><StatusText status={row.status} /></dd></div>
        <div><dt>Provider</dt><dd>{row.provider} <LineageTag lineage={row.source} /></dd></div>
        <div><dt>Modality</dt><dd>{row.modality}</dd></div>
        {row.unlisted ? (
          <div><dt>Registry</dt><dd><span className="badge badge-warning">Unlisted provider</span></dd></div>
        ) : null}
        <div><dt>Qubits</dt><dd>{row.qubits ?? '—'}</dd></div>
        <div><dt>Queue depth</dt><dd>{row.queue != null ? row.queue : '—'} <span className="page-hint">Telemetry snapshot</span></dd></div>
        <div><dt>Active alerts</dt><dd>{row.alerts != null ? row.alerts : '—'} <span className="page-hint">This backend · ACTIVE</span></dd></div>
        <div>
          <dt>Last telemetry</dt>
          <dd>
            {formatAge(row.age)}
            {isStale(row.age) ? ` · stale (>${STALE_MIN}m)` : ''}
          </dd>
        </div>
      </dl>
      {row.counts ? (
        <section className="bk-preview-health" aria-label="Qubit health">
          <span className="bk-filter-group__title">Qubit health</span>
          <StateBar counts={row.counts} total={total} label={row.name} />
        </section>
      ) : (
        <p className="page-hint">Health vector not loaded for this backend.</p>
      )}
    </DetailDrawer>
  );
}
