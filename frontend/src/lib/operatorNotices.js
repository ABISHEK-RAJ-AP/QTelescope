const STORAGE_KEY = 'qts_operator_notices_v1';
const TOAST_GATE_KEY = 'qts_operator_toast_gate_v1';
export const OPERATOR_NOTICES_EVENT = 'qts:operator-notices';

function readToastGate() {
  try {
    return JSON.parse(sessionStorage.getItem(TOAST_GATE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeToastGate(gate) {
  try {
    sessionStorage.setItem(TOAST_GATE_KEY, JSON.stringify(gate));
  } catch {
    /* ignore */
  }
}

/** One toast per notice id + body fingerprint per browser session (stops effect-loop spam). */
export function shouldShowOperatorToast(id, body) {
  if (!id) return false;
  const gate = readToastGate();
  const fp = String(body || '').trim();
  return gate[id] !== fp;
}

export function markOperatorToastShown(id, body) {
  if (!id) return;
  const gate = readToastGate();
  gate[id] = String(body || '').trim();
  writeToastGate(gate);
}

export function clearOperatorToastGate(id) {
  if (!id) return;
  const gate = readToastGate();
  delete gate[id];
  writeToastGate(gate);
}

function emit() {
  window.dispatchEvent(new CustomEvent(OPERATOR_NOTICES_EVENT));
}

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    /* ignore */
  }
  emit();
}

export function listOperatorNotices() {
  return readRaw();
}

export function getActiveOperatorNotices(now = Date.now()) {
  return readRaw().filter(
    (n) => n.state !== 'dismissed' && (!n.snoozeUntil || n.snoozeUntil <= now),
  );
}

export function unreadOperatorNoticeCount(now = Date.now()) {
  return getActiveOperatorNotices(now).filter((n) => !n.seen).length;
}

export function upsertOperatorNotice(notice) {
  const id = notice.id;
  if (!id) return null;
  const now = Date.now();
  const list = readRaw();
  const idx = list.findIndex((n) => n.id === id);
  const next = {
    id,
    title: notice.title || 'Notice',
    body: notice.body || '',
    variant: notice.variant || 'info',
    actions: notice.actions || [],
    createdAt: notice.createdAt ?? now,
    updatedAt: now,
    state: 'active',
    seen: false,
    snoozeUntil: notice.snoozeUntil ?? null,
  };
  if (idx >= 0) {
    const prev = list[idx];
    const bodyChanged = (prev.body || '') !== (next.body || '');
    list[idx] = {
      ...prev,
      ...next,
      seen: bodyChanged ? false : prev.seen,
      state: prev.state === 'dismissed' && !bodyChanged ? 'dismissed' : 'active',
      createdAt: prev.createdAt ?? next.createdAt,
    };
  } else {
    list.unshift(next);
  }
  write(list);
  return next;
}

export function markOperatorNoticesSeen() {
  const list = readRaw().map((n) => ({ ...n, seen: true }));
  write(list);
}

export function dismissOperatorNotice(id) {
  clearOperatorToastGate(id);
  const list = readRaw().map((n) => (n.id === id ? { ...n, state: 'dismissed', seen: true } : n));
  write(list);
}

export function snoozeOperatorNotice(id, untilMs) {
  const list = readRaw().map((n) => (
    n.id === id ? { ...n, snoozeUntil: untilMs, seen: true } : n
  ));
  write(list);
}

export function clearDismissedOperatorNotices() {
  write(readRaw().filter((n) => n.state !== 'dismissed'));
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function remindOperatorNoticeLater(id) {
  markOperatorToastShown(id, '__snoozed__');
  snoozeOperatorNotice(id, Date.now() + DAY_MS);
}
