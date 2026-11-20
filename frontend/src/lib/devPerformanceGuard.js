/**
 * Swallow known extension/devtools PerformanceObserver noise (reportAllChanges / startTime).
 * Does not patch PerformanceObserver — subclassing breaks supportedEntryTypes getter.
 */
if (typeof window !== 'undefined') {
  const isPerfNoise = (msg, stack) => {
    const blob = `${String(msg || '')}\n${String(stack || '')}`;
    if (blob.includes('reportAllChanges')) return true;
    if (/\bVM\d+:/.test(blob) && /reportAllChanges|PerformanceObserver/i.test(blob)) {
      return true;
    }
    if (/reading 'startTime'|Cannot read properties of undefined.*startTime/i.test(blob)) {
      return blob.includes('reportAllChanges')
        || /\bVM\d+:/.test(blob)
        || blob.includes('PerformanceObserver');
    }
    return false;
  };

  const swallow = (msg, stack) => {
    if (!isPerfNoise(msg, stack)) return false;
    return true;
  };

  window.addEventListener(
    'error',
    (event) => {
      const msg = String(event.message || '');
      const stack = String(event.error?.stack || '');
      if (swallow(msg, stack)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason || '');
    const stack = String(reason?.stack || '');
    if (swallow(msg, stack)) {
      event.preventDefault();
    }
  });

  const prevOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (swallow(String(message || ''), String(error?.stack || ''))) {
      return true;
    }
    if (typeof prevOnError === 'function') {
      return prevOnError(message, source, lineno, colno, error);
    }
    return false;
  };
}