/**
 * Shared operator-facing copy defaults (errors, empty states).
 * Page-specific text stays on the page; use these for generic shells only.
 */

export const EMPTY_DEFAULTS = {
  title: 'No records',
  message: 'Nothing matches the current selection.',
};

export const EMPTY_CHART = {
  title: 'No series',
  message: 'No measurements for the selected time range and filters.',
};

export const ERROR_DEFAULTS = {
  title: 'Unable to load',
  message: 'The request did not complete. Retry, or open Platform health if the problem persists.',
};

export const ERROR_RETRY_LABEL = 'Retry';

/** Operator-facing load failure (resource = noun phrase, lowercase). */
export function unableToLoad(resource, nextStep = 'Retry or check Platform health.') {
  const what = resource ? resource.trim() : 'this data';
  return `Unable to load ${what}. ${nextStep}`;
}

/** Shorter label for KPI / inline slots */
export function unableToLoadLabel(resource) {
  return `Unable to load ${resource ? resource.trim() : 'data'}`;
}
