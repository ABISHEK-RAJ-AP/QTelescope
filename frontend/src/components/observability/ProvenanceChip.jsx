import React from 'react';
import { DataSourceBadge, DATA_SOURCE_META } from './DataSourceBadge.jsx';

/** Map product vocabulary → DataSourceBadge kinds. */
export function normalizeProvenanceKind(kind) {
  const key = String(kind || 'unknown').toLowerCase().replace(/-/g, '_');
  const alias = {
    provider: 'live',
    stored: 'cached',
    derived: 'partial',
    advisory: 'partial',
    imported: 'cached',
  };
  return alias[key] || key;
}

/**
 * Compact panel-level trust chip with optional expand (P0.9).
 * Simulated/mock catalog hidden from chrome (same as DataSourceBadge).
 */
export function ProvenanceChip({ kind = 'unknown', asOf, detail, className = '', compact = false }) {
  const normalized = normalizeProvenanceKind(kind);
  if (normalized === 'simulated' || normalized === 'mock_catalog') return null;

  const meta = DATA_SOURCE_META[normalized] || DATA_SOURCE_META.unknown;
  const hasExpand = Boolean(asOf || detail);

  if (compact) {
    const tip = [meta.label, meta.help, asOf ? `As of ${asOf}` : '', detail || ''].filter(Boolean).join(' · ');
    return (
      <span
        className={`provenance-chip--dot provenance-chip--dot--${normalized} ${className}`.trim()}
        title={tip}
        aria-label={tip}
      >
        ●
      </span>
    );
  }

  if (!hasExpand) {
    return <DataSourceBadge kind={normalized} className={className} />;
  }

  return (
    <details className={`provenance-chip ${className}`.trim()}>
      <summary className="provenance-chip__summary">
        <DataSourceBadge kind={normalized} showHelp={false} />
      </summary>
      <div className="provenance-chip__body">
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>{meta.help}</p>
        {asOf && (
          <p className="provenance-chip__asof" style={{ margin: '6px 0 0', fontSize: 11, opacity: 0.85 }}>
            As of {asOf}
          </p>
        )}
        {detail && (
          <p className="provenance-chip__detail" style={{ margin: '6px 0 0', fontSize: 11, opacity: 0.85 }}>
            {detail}
          </p>
        )}
      </div>
    </details>
  );
}
