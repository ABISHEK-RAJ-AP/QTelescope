const KEY = 'qre_queue_ids';

export function writeQueueIds(ids) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ids.filter(Boolean)));
  } catch {
    /* ignore quota */
  }
}

export function readQueueIds() {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function queueNeighbors(workloadId) {
  const ids = readQueueIds();
  const i = ids.indexOf(workloadId);
  if (i < 0) return { prev: '', next: '', index: -1, total: ids.length };
  return { prev: ids[i - 1] || '', next: ids[i + 1] || '', index: i, total: ids.length };
}
