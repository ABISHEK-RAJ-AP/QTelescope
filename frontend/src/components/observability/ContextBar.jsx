import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { TimeRangeSelector } from './TimeRangeSelector.jsx';

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
        <label className="context-bar__field">
          <span className="page-filter-row__label">Backend</span>
          <select
            className="input-control"
            value={backend || ''}
            disabled={readOnly || !onBackendChange}
            onChange={(e) => onBackendChange?.(e.target.value)}
            aria-label="Backend scope"
          >
            {!backend && <option value="">All backends</option>}
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
      {hint && <span className="page-hint context-bar__hint">{hint}</span>}
    </div>
  );
}
