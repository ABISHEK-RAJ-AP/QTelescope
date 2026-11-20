/** Display wait time when vendor omits ETA but queue depth is non-zero. */

export function resolveWaitSeconds(pending, waitSeconds, analytics) {
  const p = Number(pending) || 0;
  const w = waitSeconds != null ? Number(waitSeconds) : null;
  if (w != null && Number.isFinite(w)) {
    if (p > 0 && w <= 0) {
      return { seconds: null, inferred: false, reason: 'vendor_zero' };
    }
    return { seconds: w, inferred: false, reason: 'vendor' };
  }
  if (p > 0) {
    const mean = analytics?.wait_mean_s;
    if (mean != null && Number(mean) > 0) {
      return { seconds: Number(mean), inferred: true, reason: 'history_mean' };
    }
    return { seconds: null, inferred: false, reason: 'missing' };
  }
  if (w === 0) return { seconds: 0, inferred: false, reason: 'vendor' };
  return { seconds: null, inferred: false, reason: 'empty' };
}

export function formatWaitFromResolved(resolved, pending) {
  const p = pending != null ? Number(pending) : 0;
  if (!resolved || resolved.seconds == null) {
    if (resolved?.reason === 'vendor_zero' || (p > 0 && resolved?.reason === 'missing')) {
      return { text: '—', title: 'Queue depth reported; wait time not supplied in the latest status poll.' };
    }
    if (p <= 0) return { text: '—', title: 'No jobs in queue.' };
    return { text: '—', title: 'Wait time unavailable.' };
  }
  const s = resolved.seconds;
  const body = s <= 0 ? '0s' : s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  const prefix = resolved.inferred ? '~' : '';
  const title = resolved.inferred
    ? 'Approximate wait from stored history mean — latest poll had queue depth only.'
    : 'From latest backend status poll.';
  return { text: `${prefix}${body}`, title };
}