import React from 'react';
import './fleetShared.css';

export function LineageChip({ lineage }) {
  const l = lineage || 'unknown';
  if (l === 'simulated' || l === 'mock_catalog') return null;
  return (
    <span className={`fs-lineage fs-lineage--${l}`} title={l === 'live' ? 'Collected from the provider API.' : 'Provenance unknown'}>
      {l === 'live' ? 'Live' : 'Unknown'}
    </span>
  );
}

const STATES = [['GREEN', 'green'], ['YELLOW', 'yellow'], ['RED', 'red'], ['UNKNOWN', 'unknown']];

/** Qubit state bar with text counts (not colour-only). */
export function StateBar({ counts = {} }) {
  const total = STATES.reduce((a, [k]) => a + (counts[k] || 0), 0);
  if (!total) return <span className="fs-muted">No qubit telemetry</span>;
  const label = STATES.map(([k]) => `${counts[k] || 0} ${k.toLowerCase()}`).join(', ');
  return (
    <div>
      <div className="fs-bar" role="img" aria-label={`Qubit states: ${label}`}>
        {STATES.map(([k, c]) => (counts[k] ? (
          <span key={k} className={`fs-seg fs-seg--${c}`} style={{ width: `${(counts[k] / total) * 100}%` }} />
        ) : null))}
      </div>
      <div className="fs-bar__nums">
        {STATES.map(([k, c]) => (
          <span key={k} className={`fs-num fs-num--${c}`}>
            <i aria-hidden />{counts[k] || 0} {k.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

