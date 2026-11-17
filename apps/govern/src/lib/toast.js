let listeners = [];
let seq = 0;

export function toast(message, tone = 'ok') {
  const text = String(message || '').trim();
  if (!text) return;
  const item = { id: ++seq, message: text, tone: tone === 'err' || tone === 'error' ? 'err' : tone === 'warn' ? 'warn' : 'ok' };
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
  if (/fail|denied|error|invalid|not found|required|unable|cannot/.test(t)) return 'err';
  return 'ok';
}
