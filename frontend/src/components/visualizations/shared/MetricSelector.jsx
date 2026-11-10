/**
 * MetricSelector
 * --------------
 * A labeled <select> control for picking a metric or dimension.
 *
 * Props:
 *   options  — Array of { value: string, label: string, unit?: string }
 *   value    — Currently selected value
 *   onChange — Change handler (event) => void
 *   label    — Visible label text (string)
 *   disabled — Whether the control is disabled (bool, default: false)
 *   id       — Optional explicit id (auto-generated from label if omitted)
 */

import { useId } from 'react';

export function MetricSelector({
  options = [],
  value,
  onChange,
  label,
  disabled = false,
  id: externalId,
}) {
  const autoId = useId();
  const selectId = externalId ?? `metric-selector-${autoId}`;
  const ariaLabel = label ?? 'Select metric';

  return (
    <div className="viz-metric-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {label && (
        <label
          htmlFor={selectId}
          style={{
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className="input-control"
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-label={!label ? ariaLabel : undefined}
        style={{
          fontSize: '0.8125rem',
          minWidth: '10ch',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
            {opt.unit ? ` (${opt.unit})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
