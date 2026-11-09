/** ponytail: navigation timing only — not full RUM SDK. */
export function readClientVitals() {
  if (typeof window === 'undefined' || !window.performance) return null;
  const nav = performance.getEntriesByType('navigation')[0];
  if (!nav || !Number.isFinite(nav.startTime)) return null;
  const paint = performance.getEntriesByType('paint');
  const fcp = paint.find((e) => e.name === 'first-contentful-paint');
  const safe = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? Math.round(a - b) : null);
  return {
    domContentLoadedMs: safe(nav.domContentLoadedEventEnd, nav.startTime),
    loadMs: safe(nav.loadEventEnd, nav.startTime),
    ttfbMs: safe(nav.responseStart, nav.requestStart),
    fcpMs: fcp && Number.isFinite(fcp.startTime) ? Math.round(fcp.startTime) : null,
    transferKb: nav.transferSize ? Math.round(nav.transferSize / 1024) : null,
  };
}

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export function assertImportSize(bytes, label = 'File') {
  if (bytes > MAX_IMPORT_BYTES) {
    throw new Error(`${label} exceeds ${MAX_IMPORT_BYTES / (1024 * 1024)} MB limit`);
  }
}
