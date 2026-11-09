import React from 'react';
import './appFormField.css';

/** Shared form field chrome for console pages (labels, errors, hints). */
export function AppFormField({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  counter,
  children,
  className = '',
}) {
  const errId = error && htmlFor ? `${htmlFor}-error` : undefined;
  const hintId = hint && htmlFor ? `${htmlFor}-hint` : undefined;
  return (
    <div className={`app-field${error ? ' app-field--invalid' : ''}${className ? ` ${className}` : ''}`}>
      {label ? (
        <label className="app-field__label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="app-field__req" aria-hidden> *</span> : null}
        </label>
      ) : null}
      {hint ? (
        <p className="app-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <div
        className="app-field__control"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={[errId, hintId].filter(Boolean).join(' ') || undefined}
      >
        {children}
      </div>
      {error ? (
        <p className="app-field__error" id={errId} role="alert">
          {error}
        </p>
      ) : null}
      {counter ? <p className="app-field__counter">{counter}</p> : null}
    </div>
  );
}
