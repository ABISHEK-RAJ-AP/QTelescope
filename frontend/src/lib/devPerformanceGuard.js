/**
 * Dev-only: swallow known extension/devtools PerformanceObserver noise (VM499 startTime).
 * Does not patch PerformanceObserver — subclassing breaks supportedEntryTypes getter.
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      const msg = String(event.message || '');
      const stack = String(event.error?.stack || '');
      if (
        msg.includes('startTime')
        && (msg.includes('reportAllChanges') || stack.includes('reportAllChanges'))
      ) {
        event.preventDefault();
      }
    },
    true,
  );
}
