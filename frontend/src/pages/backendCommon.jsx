import React, { useMemo } from 'react';
import { AlertTriangle, Hash } from 'lucide-react';
import { InfoTooltip } from '../components/observability/InfoTooltip.jsx';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { getChartTheme } from '../components/observability/chartTheme.js';
import { STATES, STATE_GLYPH, STATE_LABEL } from './backendUtils.js';
import { formatEnumLabel, formatOperationalStatus } from '../lib/displayLabels.js';
import { COPY } from '../copy/operator.js';
import './BackendInventory.css';

/** Registry id — hover or focus shows full technical id; not primary chrome. */
export function BackendRegistryIdChip({ backendId, className = '', onCopy }) {
  const id = String(backendId || '').trim();
  if (!id) return null;
  const copy = (e) => {
    e?.stopPropagation?.();
    if (onCopy) { onCopy(id); return; }
  void navigator.clipboard?.writeText(id).catch(() => {});
  };
  return (
    <button
      type="button"
      className={`bk-id-chip${className ? ` ${className}` : ''}`}
      title={`Registry ID: ${id}`}
      aria-label={`Registry ID ${id}. Activate to copy.`}
      onClick={copy}
    >
      <Hash size={14} strokeWidth={2.25} aria-hidden />
    </button>
  );
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

export function StateBar({ counts, total, label, emptyLabel = 'No qubit health' }) {
  const t = total ?? STATES.reduce((a, s) => a + (counts?.[s] || 0), 0);
  if (!t) return <span className="bk-muted">{emptyLabel}</span>;
  const text = STATES.filter((s) => counts?.[s]).map((s) => `${counts[s]} ${STATE_LABEL[s].toLowerCase()}`).join(', ');
  return (
    <div className="bk-statebar" title={label || text}>
      <div className="bk-bar" role="img" aria-label={`${label ? `${label}: ` : ''}${text}`}>
        {STATES.map((s) => (counts?.[s] ? (
          <span key={s} className={`bk-seg bk-seg--${s}`} style={{ width: `${(counts[s] / t) * 100}%` }} />
        ) : null))}
      </div>
      <ul className="bk-statebar__legend">
        {STATES.filter((s) => counts?.[s]).map((s) => (
          <li key={s}><span className={`bk-legend-dot bk-legend-dot--${s}`} aria-hidden />{counts[s]} {STATE_LABEL[s]}</li>
        ))}
      </ul>
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
              {STATE_LABEL[routingState] || formatEnumLabel(routingState)}
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

