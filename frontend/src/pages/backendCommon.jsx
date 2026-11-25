import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { InfoTooltip } from '../components/observability/InfoTooltip.jsx';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { getChartTheme } from '../components/observability/chartTheme.js';
import { STATES, STATE_GLYPH, STATE_TIER } from './backendUtils.js';
import { formatEnumLabel, formatOperationalStatus } from '../lib/displayLabels.js';
import { COPY } from '../copy/operator.js';
import './BackendInventory.css';

/** Native tooltip on titles — registry id on hover, no separate hash control. */
export function backendRegistryHoverTitle(displayLabel, backendId) {
  const id = String(backendId || '').trim();
  if (!id) return displayLabel ? String(displayLabel) : undefined;
  const label = String(displayLabel || '').trim();
  if (!label || label === id) return `Registry ID: ${id}`;
  return `${label} — registry ID: ${id}`;
}

const LINEAGE_COPY = {
  live: { short: 'Live ingest', title: 'Last collector run used a live vendor path' },
  simulated: { short: 'Demo catalog', title: 'Synthetic telemetry for lab demo — not live hardware' },
  mock_catalog: { short: 'Demo catalog', title: 'Seeded demo backend' },
  stub: { short: 'Catalog stub', title: 'Credential slot only — no live collector' },
  replay: { short: 'Replay', title: 'Stored replay snapshot' },
  unknown: { short: 'Source pending', title: 'Collector lineage not recorded yet — refresh or run collectors' },
};

export function LineageTag({ lineage, compact = false, showDemo = true }) {
  const l = (lineage || 'unknown').toLowerCase();
  if (!showDemo && (l === 'simulated' || l === 'mock_catalog')) return null;
  const copy = LINEAGE_COPY[l] || LINEAGE_COPY.unknown;
  const text = compact ? copy.short : copy.short;
  return (
    <span className={`bk-lineage bk-lineage--${l}${compact ? ' bk-lineage--compact' : ''}`} title={copy.title}>
      <span className="bk-lineage__dot" aria-hidden />
      {text}
    </span>
  );
}

export function StateBar({ counts, total, label, emptyLabel = 'No qubit health', compact = false }) {
  const t = total ?? STATES.reduce((a, s) => a + (counts?.[s] || 0), 0);
  if (!t) return <span className="bk-muted">{emptyLabel}</span>;
  const parts = STATES.filter((s) => counts?.[s]).map((s) => ({
    key: s,
    n: counts[s],
    tier: STATE_TIER[s],
    phrase: `${counts[s]} ${STATE_TIER[s].toLowerCase()}`,
  }));
  const text = parts.map((p) => p.phrase).join(', ');
  const ariaText = parts.map((p) => `${p.n} qubits ${p.tier.toLowerCase()}`).join(', ');
  return (
    <div className="bk-statebar" title={label ? `${label} — ${ariaText}` : ariaText}>
      <div className="bk-bar" role="img" aria-label={`${label ? `${label}: ` : ''}${ariaText}`}>
        {STATES.map((s) => (counts?.[s] ? (
          <span key={s} className={`bk-seg bk-seg--${s}`} style={{ width: `${(counts[s] / t) * 100}%` }} title={`${counts[s]} ${STATE_TIER[s].toLowerCase()}`} />
        ) : null))}
      </div>
      {compact ? (
        <p className="bk-statebar__summary">{parts.map((p) => p.phrase).join(' · ')}</p>
      ) : (
        <ul className="bk-statebar__legend">
          {parts.map((p) => (
            <li key={p.key} title={`${p.tier} — qubits within health-vector tier`}>
              <span className={`bk-legend-dot bk-legend-dot--${p.key}`} aria-hidden />
              <span className="bk-legend-count">{p.n}</span>
              <span className="bk-legend-tier">{p.tier}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StatusText({ status, showKey = false }) {
  const { key, label, title } = formatOperationalStatus(status);
  const ok = key === 'ONLINE';
  const cls = ok ? 'badge-online' : key === 'DEGRADED' || key === 'MAINTENANCE' ? 'badge-warning' : 'badge-offline';
  return (
    <span className={`badge ${cls}`} title={title} data-ops-status={key}>
      {label}{showKey && key !== label ? ` (${key})` : ''}
    </span>
  );
}

/** Reachability vs data source vs routing — three different signals, one row. */
const COVERAGE_HELP = 'Qubits lack T1/T2 in stored telemetry. Scored as Unknown — not a hardware failure.';

/** Gate histograms on backend calibration tab — health vector proxy, not per-gate tables. */
export const GATE_ERROR_PROVENANCE =
  'Gate error = 1 − per-qubit fidelity from the health vector. Per-gate calibration tables are not available for this backend.';

export const QUBIT_MAP_LEGEND_HELP =
  'Cell colour = router health state (nominal, watch, degraded, unknown). Marker shapes in the legend distinguish watch and degraded. Without a health vector, all qubits render as unknown. Open Resource health for fleet scoring.';

export const QUBIT_HEALTH_MINI_MAP_HELP =
  'Colour = router health state; each cell links to Resource health. Use the Qubits tab for sortable table and filters.';

/** Compact coherence coverage signal — icon + counts; detail in tooltip. */
export function TelemetryCoverageHint({ unknownCount, totalCount, className = '' }) {
  const unknown = Number(unknownCount) || 0;
  if (unknown <= 0) return null;
  const total = totalCount ?? '—';
  return (
    <span className={`bk-coverage-hint${className ? ` ${className}` : ''}`} role="status">
      <AlertTriangle size={14} aria-hidden className="bk-coverage-hint__icon" />
      <span className="bk-coverage-hint__nums" aria-label={`${unknown} of ${total} qubits lack T1/T2 in stored telemetry`}>
        {unknown}/{total}
      </span>
      <InfoTooltip label="Partial coherence coverage">{COVERAGE_HELP}</InfoTooltip>
    </span>
  );
}

/** @deprecated Use TelemetryCoverageHint — alias for existing imports. */
export function TelemetryCoverageCallout(props) {
  return <TelemetryCoverageHint {...props} />;
}

export function BackendStatusStrip({ operationalStatus, routingState, routingAction, lineage, lineageLoaded = true }) {
  const routeTitle = routingAction
    ? `Advisory routing — ${formatEnumLabel(routingAction)} (rule engine; not vendor health)`
    : 'Advisory routing from health vector rules';
  return (
    <dl className="bk-status-strip">
      <div>
        <dt>Reachability</dt>
        <dd><StatusText status={operationalStatus} /></dd>
      </div>
      <div>
        <dt>Data source</dt>
        <dd><LineageTag lineage={lineageLoaded ? lineage : 'unknown'} compact showDemo /></dd>
      </div>
      {routingState ? (
        <div>
          <dt>Routing advisory</dt>
          <dd>
            <span className="bd-routing bk-status-strip__route" data-s={routingState} title={routeTitle}>
              {STATE_TIER[routingState] || formatEnumLabel(routingState)}
            </span>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

export function Sparkline({ values, label, height = 36 }) {
  const { resolved } = useTheme();
  const t = getChartTheme(resolved === 'dark');
  const option = useMemo(() => ({
    animation: false,
    grid: { left: 0, right: 0, top: 4, bottom: 4 },
    xAxis: { type: 'category', show: false, data: values.map((_, i) => i) },
    yAxis: { type: 'value', show: false, scale: true },
    series: [{ type: 'line', data: values, showSymbol: false, lineStyle: { width: 1.5, color: t.textColor }, areaStyle: { opacity: 0.08, color: t.textColor } }],
  }), [values, t.textColor]);
  if (values.length < 2) return <div className="bk-spark bk-muted" style={{ height }}>{COPY.telemetry.notEnoughSamples}</div>;
  return (
    <div role="img" aria-label={`${label} trend, ${values.length} samples, latest ${values[values.length - 1]}, min ${Math.min(...values)}, max ${Math.max(...values)}`}>
      <QtECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

