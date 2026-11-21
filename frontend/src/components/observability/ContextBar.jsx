import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { TimeRangeSelector } from './TimeRangeSelector.jsx';
import { InfoTooltip } from './InfoTooltip.jsx';

/**
 * Scope strip: backend + optional lookback, synced to URL via useAppScope in parent.
 */
export function ContextBar({
  backend,
  onBackendChange,
  backends: backendsProp,
  showBackend = true,
  hours,
  onHoursChange,
  showTimeRange = false,
  timeRangeAffectsQuery = true,
  alertId,
  readOnly = false,
  hint,
  scopeHelp,
  children,
}) {
  const [backends, setBackends] = useState(backendsProp || []);

  useEffect(() => {
    if (backendsProp?.length) {
      setBackends(backendsProp);
      return;
    }
    let cancelled = false;
    api.getBackends()
      .then((list) => { if (!cancelled) setBackends(list || []); })
      .catch(() => { if (!cancelled) setBackends([]); });
    return () => { cancelled = true; };
  }, [backendsProp]);

  return (
    <div className="context-bar card page-panel" role="region" aria-label="View context">
      {showBackend && (
        <label className="context-bar__field outline-field">
          <span className="qt-title-with-help context-bar__label">
            <span>Backend</span>
            {scopeHelp ? (
              <InfoTooltip label="Stream scope" align="start">
                {scopeHelp}
              </InfoTooltip>
            ) : null}
          </span>
          <select
            className="input-control"
            value={backend || ''}
            disabled={readOnly || !onBackendChange}
            onChange={(e) => onBackendChange?.(e.target.value)}
            aria-label="Backend scope"
          >
            <option value="">All backends</option>
            {backends.map((b) => (
              <option key={b.backend_id} value={b.backend_id}>
                {b.backend_name || b.backend_id}
              </option>
            ))}
          </select>
        </label>
      )}
      {showTimeRange && hours != null && onHoursChange && (
        <div className="context-bar__field context-bar__field--range">
          <TimeRangeSelector
            hours={hours}
            onChange={onHoursChange}
            affectsQuery={timeRangeAffectsQuery}
          />
        </div>
      )}
      {alertId && (
        <span className="context-bar__pill" title="Alert correlation from URL">
          Alert <code>{alertId}</code>
        </span>
      )}
      {children}
      {hint && <span className="page-hint context-bar__hint">{hint}</span>}
    </div>
  );
}
