/**
 * Shared operator-facing copy defaults (errors, empty states).
 * Page-specific text stays on the page; use these for generic shells only.
 */

export const EMPTY_DEFAULTS = {
  title: 'Nothing to show',
  message: 'No records match this view. Clear a filter, or wait for the next collection.',
};

export const EMPTY_CHART = {
  title: 'No measurements yet',
  message: 'This chart has no samples for the current scope. Widen the window or wait for collection.',
};

export const FLEET_TELEMETRY_EMPTY = {
  title: 'Telemetry not connected',
  message: 'Queue, calibration, and coherence charts need at least one successful collection.',
};

export const ERROR_DEFAULTS = {
  title: 'Could not load this view',
  message: 'The request failed. Retry. If it fails again, open Platform health.',
};

export const ERROR_RETRY_LABEL = 'Retry';

/** Operator-facing load failure (resource = noun phrase, lowercase). */
export function unableToLoad(resource, nextStep = 'Retry or check Platform health.') {
  const what = resource ? resource.trim() : 'this data';
  return `Could not load ${what}. ${nextStep}`;
}

/** Shorter label for KPI / inline slots */
export function unableToLoadLabel(resource) {
  return `Could not load ${resource ? resource.trim() : 'data'}`;
}
