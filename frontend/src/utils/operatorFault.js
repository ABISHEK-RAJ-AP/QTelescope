/**
 * Map raw collector/API errors to short operator-safe text (no SQL/stack payloads).
 * ponytail: full detail stays in server logs — SuperAdmin uses admin logs.
 */

const SQL_RE = /sql|sqlite|sqlalchemy|unique constraint|integrity error|operationalerror|no such table|database is locked/i;
const TIMEOUT_RE = /timeout|timed out|deadline/i;
const AUTH_RE = /401|403|unauthorized|forbidden|authentication/i;
const NET_RE = /connection refused|econnrefused|unreachable|network|dns/i;

/** @param {string|undefined|null} raw */
export function summarizeOperatorError(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';

  if (SQL_RE.test(s)) return 'The data store rejected the request. Retry, or open Platform health.';
  if (TIMEOUT_RE.test(s)) return 'The request timed out. Retry in a moment.';
  if (AUTH_RE.test(s)) return 'Sign-in was rejected. Check your session and try again.';
  if (NET_RE.test(s)) return 'The service could not be reached. Check the network, then retry.';

  if (s.length > 72 || s.includes('\n') || s.includes('Traceback')) return 'Collection failed. Retry, or open Platform health.';

  const lower = s.toLowerCase();
  if (lower === s && s.length < 40) return s;

  return 'collection failed';
}

/** Human label for circuit breaker JSON from collector admin APIs. */
export function summarizeCircuitBreaker(providerId, payload) {
  if (!payload) return `${providerId}: unknown`;
  const state = String(payload.state || payload.status || '').toUpperCase();
  if (state === 'OPEN') {
    const retry = payload.retry_after_sec ?? payload.retry_in_sec;
    const n = payload.failure_count ?? payload.consecutive_failures;
    const failPart = n != null ? ` after ${n} failure${n === 1 ? '' : 's'}` : '';
    const retryPart = retry != null ? ` — retry in ${Math.max(1, Math.round(Number(retry) / 60))} min` : '';
    return `${providerId}: paused${failPart}${retryPart}`;
  }
  if (state === 'HALF_OPEN') return `${providerId}: testing recovery`;
  if (state) return `${providerId}: ${state.toLowerCase()}`;
  return `${providerId}: active`;
}

/**
 * @param {string} providerId
 * @param {{ status?: string, error?: string }} collector
 * @param {{ stale?: boolean }} opts
 */
export function collectorQueueTitle(providerId, collector, { stale = false } = {}) {
  const bad = collector?.status && collector.status !== 'OK';
  const state = bad ? collector.status : stale ? 'stale' : 'OK';
  let title = `Collector ${providerId}: ${state}`;
  if (collector?.error) {
    const hint = summarizeOperatorError(collector.error);
    if (hint) title += ` — ${hint}`;
  }
  return title;
}
