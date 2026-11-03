import React from 'react';
import './Toggle.css';

/** Accessible pill toggle (checkbox under the hood). */
export function Toggle({
  checked,
  disabled = false,
  onChange,
  label,
  id,
  className = '',
}) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <label className={`ui-toggle ${className}`.trim()} htmlFor={inputId}>
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="ui-toggle__track" aria-hidden />
      {label != null && label !== '' && <span className="ui-toggle__label">{label}</span>}
    </label>
  );
}
