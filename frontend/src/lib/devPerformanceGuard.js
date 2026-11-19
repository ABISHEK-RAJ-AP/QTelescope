/**
 * Swallow known extension/devtools PerformanceObserver noise (reportAllChanges / startTime).
 * Does not patch PerformanceObserver — subclassing breaks supportedEntryTypes getter.
 */
if (typeof window !== 'undefined') {
  const isPerfNoise = (msg, stack) => {
    const blob = `${String(msg || '')}\n${String(stack || '')}`;
    return blob.includes('reportAllChanges')
      && (blob.includes('startTime') || blob.includes("reading 'startTime'"));
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