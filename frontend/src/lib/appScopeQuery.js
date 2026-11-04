/** Shared URL query keys for investigation / analyze scope (P1.1). */

export const SCOPE_QUERY = {
  backend: 'backend',
  hours: 'hours',
  alert: 'alert',
  queue: 'queue',
};

export function parseScopeSearch(searchParams) {
  const params = searchParams instanceof URLSearchParams
    ? searchParams
    : new URLSearchParams(searchParams || '');

  const backend = params.get(SCOPE_QUERY.backend) || '';
  const rawHours = params.get(SCOPE_QUERY.hours);
  let hours = null;
  if (rawHours != null && rawHours !== '') {
    const n = Number(rawHours);
    if (Number.isFinite(n)) hours = Math.min(168, Math.max(1, Math.round(n)));
  }
  const alertId = params.get(SCOPE_QUERY.alert) || '';

  return { backend, hours, alertId };
}

export function mergeScopeSearch(prev, patch) {
  const next = new URLSearchParams(prev instanceof URLSearchParams ? prev : String(prev || ''));

  if ('backend' in patch) {
    const v = patch.backend;
    if (v) next.set(SCOPE_QUERY.backend, v);
    else next.delete(SCOPE_QUERY.backend);
  }
  if ('hours' in patch) {
    const v = patch.hours;
    if (v != null && v !== '') next.set(SCOPE_QUERY.hours, String(v));
    else next.delete(SCOPE_QUERY.hours);
  }
  if ('alertId' in patch) {
    const v = patch.alertId;
    if (v) next.set(SCOPE_QUERY.alert, v);
    else next.delete(SCOPE_QUERY.alert);
  }

  return next;
}
