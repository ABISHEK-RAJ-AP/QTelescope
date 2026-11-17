import {
  markGovernToastShown,
  shouldShowGovernToast,
  upsertGovernNotice,
} from './governNotices.js';

let listeners = [];
let seq = 0;

const TITLES = { ok: 'Completed', err: 'Action required', warn: 'Attention' };

export function toast(message, tone = 'ok', meta = {}) {
  const text = String(message || '').trim();
  if (!text) return;
  const normalized =
    tone === 'err' || tone === 'error' ? 'err' : tone === 'warn' ? 'warn' : 'ok';
  const id = meta.id || `govern:toast:${++seq}`;
  const item = {
    id,
    message: text,
    title: meta.title || TITLES[normalized],
    app: meta.app || 'Govern',
    tone: normalized,
    at: new Date().toISOString(),
    showToast: meta.showToast !== false,
    persist: meta.persist !== false,
  };

  if (item.persist) {
    upsertGovernNotice({
      id,
      title: item.title,
      body: text,
      tone: normalized,
      app: item.app,
      source: 'toast',
      actions: meta.actions || [],
    });
  }

  if (!item.showToast) return;
  if (!shouldShowGovernToast(id, text)) return;
  markGovernToastShown(id, text);
  listeners.forEach((fn) => fn(item));
}

export function subscribeToasts(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((x) => x !== fn);
  };
}

export function inferNoticeTone(notice) {
  const t = String(notice || '').toLowerCase();
  if (!t) return 'ok';
  if (/fail|denied|error|invalid|not found|required|unable|cannot|conflict/.test(t)) return 'err';
  if (/warn|caution|stale|pending/.test(t)) return 'warn';
  return 'ok';
}