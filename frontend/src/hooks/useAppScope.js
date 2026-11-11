import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mergeScopeSearch, parseScopeSearch } from '../lib/appScopeQuery.js';
import { TELEMETRY_WINDOW_OPTIONS } from '../utils/telemetryWindow.js';

function snapHours(hours) {
  const allowed = TELEMETRY_WINDOW_OPTIONS.map((o) => o.hours);
  if (allowed.includes(hours)) return hours;
  return 24;
}

/**
 * Read/write backend / hours / alert id on the current route search string.
 * Refresh and share links preserve scope when pages use this hook.
 */
export function useAppScope({ defaultBackend = '', defaultHours = 24 } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const { backend, hours, alertId, severity, status } = useMemo(() => {
    const parsed = parseScopeSearch(searchParams);
    return {
      backend: parsed.backend || defaultBackend || '',
      hours: snapHours(parsed.hours ?? defaultHours),
      alertId: parsed.alertId || '',
      severity: parsed.severity || '',
      status: parsed.status || '',
    };
  }, [searchParams, defaultBackend, defaultHours]);

  const patchScope = useCallback(
    (patch) => {
      setSearchParams((prev) => mergeScopeSearch(prev, patch), { replace: true });
    },
    [setSearchParams],
  );

  const setBackend = useCallback((id) => patchScope({ backend: id || '' }), [patchScope]);
  const setHours = useCallback((h) => patchScope({ hours: h }), [patchScope]);
  const setAlertId = useCallback((id) => patchScope({ alertId: id || '' }), [patchScope]);
  const setSeverity = useCallback((s) => patchScope({ severity: s || '' }), [patchScope]);
  const setStatus = useCallback((s) => patchScope({ status: s || '' }), [patchScope]);

  return {
    backend,
    hours,
    alertId,
    severity,
    status,
    patchScope,
    setBackend,
    setHours,
    setAlertId,
    setSeverity,
    setStatus,
  };
}
