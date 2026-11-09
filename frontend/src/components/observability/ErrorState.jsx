import React from 'react';
import { AlertCircle } from 'lucide-react';

export function ErrorState({
  title = 'Could not load data',
  message,
  requestId,
  diagnosticsHint,
  onRetry,
  onDiagnostics,
  variant = 'default',
  compact = false,
  align = 'center',
}) {
  const className = [
    'obs-error',
    variant === 'panel' ? 'obs-error--panel' : '',
    variant === 'inline' ? 'obs-error--inline' : '',
    compact ? 'obs-error--compact' : '',
    align === 'start' ? 'obs-error--align-start' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={className} role="alert">
      <AlertCircle size={compact ? 22 : 28} className="obs-error__icon" aria-hidden />
      <div className="obs-error__text">
        <div className="obs-error__title">{title}</div>
        {message && <p className="obs-error__message">{message}</p>}
        {requestId ? (
          <p className="obs-error__meta">Reference: <code>{requestId}</code></p>
        ) : null}
        {diagnosticsHint ? (
          <p className="obs-error__meta">{diagnosticsHint}</p>
        ) : null}
        <div className="obs-error__actions">
          {onRetry && (
            <button type="button" className="btn btn-secondary" onClick={onRetry}>
              Retry
            </button>
          )}
          {onDiagnostics && (
            <button type="button" className="btn btn-secondary" onClick={onDiagnostics}>
              View diagnostics
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
