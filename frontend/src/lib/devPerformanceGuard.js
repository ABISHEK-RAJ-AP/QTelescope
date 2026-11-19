/**
 * Swallow known extension/devtools PerformanceObserver noise (VM35 startTime / reportAllChanges).
 * Does not patch PerformanceObserver — subclassing breaks supportedEntryTypes getter.
 */
if (typeof window !== 'undefined') {
  const isPerfNoise = (msg, stack) =>
    String(msg).includes('startTime')
    && (String(msg).includes('reportAllChanges') || String(stack).includes('reportAllChanges'));

  window.addEventListener(
    'error',
    (event) => {
      const msg = String(event.message || '');
      const stack = String(event.error?.stack || '');
      if (isPerfNoise(msg, stack)) {
        event.preventDefault();
      }
    },
    true,
  );

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason || '');
    const stack = String(reason?.stack || '');
    if (isPerfNoise(msg, stack)) {
      event.preventDefault();
    }
  });
}