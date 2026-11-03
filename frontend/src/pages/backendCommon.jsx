import React, { useMemo } from 'react';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { getChartTheme } from '../components/observability/chartTheme.js';
import { STATES, STATE_GLYPH, STATE_LABEL } from './backendUtils.js';
import './BackendInventory.css';

export function LineageTag({ lineage, compact = false }) {
  const l = lineage || 'unknown';
  const text = l === 'live' ? (compact ? 'Live' : 'Live vendor') : l === 'simulated' ? 'Simulated' : (compact ? 'Unknown' : 'Unknown source');
  return (
    <span className={`bk-lineage bk-lineage--${l}${compact ? ' bk-lineage--compact' : ''}`} title={`Adapter lineage: ${l}`}>
      <span className="bk-lineage__dot" aria-hidden />
      {text}
    </span>
  );
}

export function StateBar({ counts, total, label }) {
  const t = total ?? STATES.reduce((a, s) => a + (counts?.[s] || 0), 0);
  if (!t) return <span className="bk-muted">No qubit health</span>;
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

export function StatusText({ status }) {
  const ok = status === 'ONLINE';
  const cls = ok ? 'badge-online' : status === 'DEGRADED' || status === 'MAINTENANCE' ? 'badge-warning' : 'badge-offline';
  return <span className={`badge ${cls}`}>{status || 'UNKNOWN'}</span>;
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
  if (values.length < 2) return <div className="bk-spark bk-muted" style={{ height }}>Not enough samples</div>;
  return (
    <div role="img" aria-label={`${label} trend, ${values.length} samples, latest ${values[values.length - 1]}, min ${Math.min(...values)}, max ${Math.max(...values)}`}>
      <QtECharts option={option} style={{ height, width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

