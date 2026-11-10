/** Shared lookback window for calibration / drift telemetry tabs (IMP-P2). */

export const TELEMETRY_WINDOW_KEY = 'qtelescope_telemetry_window_hours';
export const TELEMETRY_CUSTOM_KEY = 'qtelescope_telemetry_window_custom_hours';
export const TELEMETRY_CUSTOM_SENTINEL = -1;

export const TELEMETRY_WINDOW_OPTIONS = [
  { hours: 6, label: '6 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
  { hours: 336, label: '14 days' },
  { hours: 720, label: '30 days' },
  { hours: TELEMETRY_CUSTOM_SENTINEL, label: 'Custom hours…' },
];

export function clampTelemetryHours(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 24;
  return Math.min(720, Math.max(1, v));
}

export function isPresetTelemetryHours(hours) {
  return TELEMETRY_WINDOW_OPTIONS.some((o) => o.hours === hours && o.hours !== TELEMETRY_CUSTOM_SENTINEL);
}

export function readCustomTelemetryHours() {
  try {
    const raw = localStorage.getItem(TELEMETRY_CUSTOM_KEY);
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return clampTelemetryHours(n);
  } catch {
    /* ignore */
  }
  return 48;
}

export function writeCustomTelemetryHours(hours) {
  try {
    localStorage.setItem(TELEMETRY_CUSTOM_KEY, String(clampTelemetryHours(hours)));
  } catch {
    /* ignore */
  }
}

export function readTelemetryWindowHours() {
  try {
    const raw = localStorage.getItem(TELEMETRY_WINDOW_KEY);
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      if (isPresetTelemetryHours(n)) return n;
      return clampTelemetryHours(n);
    }
  } catch {
    /* ignore */
  }
  return 24;
}

export function writeTelemetryWindowHours(hours) {
  try {
    const h = clampTelemetryHours(hours);
    localStorage.setItem(TELEMETRY_WINDOW_KEY, String(h));
    if (!isPresetTelemetryHours(h)) writeCustomTelemetryHours(h);
  } catch {
    /* ignore */
  }
}

export function selectValueForTelemetryHours(hours) {
  return isPresetTelemetryHours(hours) ? hours : TELEMETRY_CUSTOM_SENTINEL;
}

/** Map window hours → API sample limits (ponytail: coarse heuristic). */
export function telemetryLimitForHours(hours) {
  return Math.min(200, Math.max(20, Math.round(hours * 4)));
}
