/**
 * Map raw collector/API errors to short operator-safe text (no SQL/stack payloads).
 * ponytail: full detail stays in server logs — SuperAdmin uses admin logs.
 */

const SQL_RE = /sql|sqlite|sqlalchemy|unique constraint|integrity error|operationalerror/i;
const TIMEOUT_RE = /timeout|timed out|deadline/i;
const AUTH_RE = /401|403|unauthorized|forbidden|authentication/i;
const NET_RE = /connection refused|econnrefused|unreachable|network|dns/i;

/** @param {string|undefined|null} raw */
export function summarizeOperatorError(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';

  if (SQL_RE.test(s)) return 'data store error';
  if (TIMEOUT_RE.test(s)) return 'timed out';
  if (AUTH_RE.test(s)) return 'auth failed';
  if (NET_RE.test(s)) return 'connection failed';

  if (s.length > 72 || s.includes('\n') || s.includes('Traceback')) return 'collection failed';

  const lower = s.toLowerCase();
  if (lower === s && s.length < 40) return s;

  return 'collection failed';
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
