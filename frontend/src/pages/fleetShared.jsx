import React from 'react';
import { STATE_TIER } from './backendUtils.js';
import './fleetShared.css';

const FLEET_BAR_STATES = ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'];

export function LineageChip({ lineage }) {
  const l = lineage || 'unknown';
  if (l === 'simulated' || l === 'mock_catalog') return null;
  return (
    <span className={`fs-lineage fs-lineage--${l}`} title={l === 'live' ? 'Collected from the provider API.' : 'Provenance unknown'}>
      {l === 'live' ? 'Live' : 'Unknown'}
    </span>
  );
}

/** Qubit health bar — colour encodes tier; captions use Nominal / Watch / Degraded / Unscored. */
export function StateBar({ counts = {} }) {
  const total = FLEET_BAR_STATES.reduce((a, k) => a + (counts[k] || 0), 0);
  if (!total) return <span className="fs-muted">No qubit telemetry</span>;
  const css = { GREEN: 'green', YELLOW: 'yellow', RED: 'red', UNKNOWN: 'unknown' };
  const ariaText = FLEET_BAR_STATES.filter((k) => counts[k])
    .map((k) => `${counts[k]} qubits ${STATE_TIER[k].toLowerCase()}`)
    .join(', ');
  return (
    <div>
      <div className="fs-bar" role="img" aria-label={`Qubit health: ${ariaText}`}>
        {FLEET_BAR_STATES.map((k) => (counts[k] ? (
          <span key={k} className={`fs-seg fs-seg--${css[k]}`} style={{ width: `${(counts[k] / total) * 100}%` }} />
        ) : null))}
      </div>
      <div className="fs-bar__nums">
        {FLEET_BAR_STATES.filter((k) => counts[k]).map((k) => (
          <span key={k} className={`fs-num fs-num--${css[k]}`}>
            <i aria-hidden />{counts[k]} <span className="fs-num__tier">{STATE_TIER[k]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

