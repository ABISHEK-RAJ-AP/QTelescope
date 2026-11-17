/** Persisted govern notices (localStorage) — mirrors Q-TeleScope `operatorNotices.js`. */

const STORAGE_KEY = 'qrp_govern_notices_v1';
const TOAST_GATE_KEY = 'qrp_govern_toast_gate_v1';
export const GOVERN_NOTICES_EVENT = 'govern:notices';

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

export function shouldShowGovernToast(id, body) {
  if (!id) return true;
  const gate = readToastGate();
  const fp = String(body || '').trim();
  return gate[id] !== fp;
}

export function markGovernToastShown(id, body) {
  if (!id) return;
  const gate = readToastGate();
  gate[id] = String(body || '').trim();
  writeToastGate(gate);
}

export function clearGovernToastGate(id) {
  if (!id) return;
  const gate = readToastGate();
  delete gate[id];
  writeToastGate(gate);
}

function emit() {
  window.dispatchEvent(new CustomEvent(GOVERN_NOTICES_EVENT));
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 60)));
  } catch {
    /* ignore */
  }
  emit();
}

export function getActiveGovernNotices(now = Date.now()) {
  return readRaw().filter(
    (n) => n.state !== 'dismissed' && (!n.snoozeUntil || n.snoozeUntil <= now),
  );
}

export function unreadGovernNoticeCount(now = Date.now()) {
  return getActiveGovernNotices(now).filter((n) => !n.seen).length;
}

function toneToVariant(tone) {
  if (tone === 'err' || tone === 'error' || tone === 'critical') return 'error';
  if (tone === 'warn') return 'warn';
  return 'info';
}

export function upsertGovernNotice(notice) {
  const id = notice.id;
  if (!id) return null;
  const now = Date.now();
  const list = readRaw();
  const idx = list.findIndex((n) => n.id === id);
  const variant = notice.variant || toneToVariant(notice.tone);
  const next = {
    id,
    title: notice.title || 'Notice',
    body: notice.body || notice.message || '',
    variant,
    tone: notice.tone || (variant === 'error' ? 'err' : variant === 'warn' ? 'warn' : 'ok'),
    app: notice.app || 'Govern',
    source: notice.source || 'local',
    actions: notice.actions || [],
    href: notice.href || null,
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

export function removeGovernNotice(id) {
  if (!id) return;
  write(readRaw().filter((n) => n.id !== id));
}

export function reconcileGovernServerNotices(keepIds) {
  const keep = keepIds instanceof Set ? keepIds : new Set(keepIds);
  const prefix = 'govern:server:';
  const list = readRaw().filter((n) => !String(n.id).startsWith(prefix) || keep.has(n.id));
  write(list);
}

export function markGovernNoticesSeen() {
  write(readRaw().map((n) => ({ ...n, seen: true })));
}

export function dismissGovernNotice(id) {
  clearGovernToastGate(id);
  write(readRaw().map((n) => (n.id === id ? { ...n, state: 'dismissed', seen: true } : n)));
}

export function snoozeGovernNotice(id, untilMs) {
  write(readRaw().map((n) => (n.id === id ? { ...n, snoozeUntil: untilMs, seen: true } : n)));
}

export function clearDismissedGovernNotices() {
  write(readRaw().filter((n) => n.state !== 'dismissed'));
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function remindGovernNoticeLater(id) {
  markGovernToastShown(id, '__snoozed__');
  snoozeGovernNotice(id, Date.now() + DAY_MS);
}

export function dismissAllActiveGovernNotices() {
  const active = new Set(getActiveGovernNotices().map((n) => n.id));
  write(
    readRaw().map((n) => (active.has(n.id) ? { ...n, state: 'dismissed', seen: true } : n)),
  );
}