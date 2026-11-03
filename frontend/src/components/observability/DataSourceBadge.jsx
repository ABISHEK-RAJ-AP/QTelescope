import React from 'react';
import { InfoTooltip } from './InfoTooltip.jsx';

const META = {
  live: {
    label: 'Live',
    className: 'ds-badge--live',
    help: 'Current data from a vendor adapter or live ingest path.',
  },
  simulated: {
    label: 'Simulated',
    className: 'ds-badge--simulated',
    help: 'Synthetic telemetry for development or demo. Not vendor hardware.',
  },
  mock_catalog: {
    label: 'Demo catalog',
    className: 'ds-badge--mock',
    help: 'Seeded demo backend for training and UI validation.',
  },
  cached: {
    label: 'Stored',
    className: 'ds-badge--cached',
    help: 'Read from the platform database, not a live vendor stream.',
  },
  stale: {
    label: 'Stale',
    className: 'ds-badge--stale',
    help: 'Newest sample is older than the operational freshness window.',
  },
  partial: {
    label: 'Partial',
    className: 'ds-badge--partial',
    help: 'Incomplete fields or time range; use with other context.',
  },
  unsupported: {
    label: 'Unsupported',
    className: 'ds-badge--unsupported',
    help: 'Not supplied for this provider or modality (expected gap).',
  },
  unknown: {
    label: 'Unknown',
    className: 'ds-badge--unknown',
    help: 'Source or freshness could not be classified.',
  },
  error: {
    label: 'Error',
    className: 'ds-badge--error',
    help: 'Collector or adapter reported a failure for this series.',
  },
  not_built: {
    label: 'Unavailable',
    className: 'ds-badge--not-built',
    help: 'Not included in this release.',
  },
};

export function DataSourceBadge({ kind = 'unknown', showHelp = true, className = '' }) {
  const key = String(kind || 'unknown').toLowerCase().replace(/-/g, '_');
  if (key === 'simulated' || key === 'mock_catalog') return null;
  const meta = META[key] || META.unknown;
  return (
    <span className={`ds-badge ${meta.className} ${className}`}>
      <span className="ds-badge__label">{meta.label}</span>
      {showHelp && (
        <InfoTooltip label={`${meta.label} data source`}>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>{meta.help}</p>
        </InfoTooltip>
      )}
    </span>
  );
}

export { META as DATA_SOURCE_META };
