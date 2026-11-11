import React from 'react';
import './MetricCard.css';

/** Shared KPI tile for fleet/inventory strips (replaces ad-hoc bk-stat markup). */
export function MetricCard({
  label,
  value,
  hint,
  scope,
  tone = 'neutral',
  className = '',
  as: Tag = 'div',
  ...rest
}) {
  const display = value == null || value === '' ? '—' : value;
  return (
    <Tag
      className={['ds-metric-card', tone !== 'neutral' ? `ds-metric-card--${tone}` : '', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <span className="ds-metric-card__label">{label}</span>
      {scope ? <span className="ds-metric-card__scope">{scope}</span> : null}
      <span className="ds-metric-card__value">{display}</span>
      {hint ? <span className="ds-metric-card__hint">{hint}</span> : null}
    </Tag>
  );
}
