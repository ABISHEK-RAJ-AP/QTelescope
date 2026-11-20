/** Min / median / max + heat colors for per-qubit and per-coupling calibration views. */

export function distributionStats(values) {
  const v = (values || [])
    .filter((x) => x != null && Number.isFinite(Number(x)))
    .map(Number);
  if (!v.length) return { min: null, max: null, median: null, n: 0 };
  const sorted = [...v].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { min, max, median, n: v.length };
}

export function sciFmt(value, sig = 3) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  if (n === 0) return '0';
  return n.toExponential(Math.max(0, sig - 1));
}

/** 0 = best (low error or high coherence), 1 = worst */
export function scaleRatio(value, stats, higherIsBetter = false) {
  if (value == null || stats?.min == null || stats?.max == null) return null;
  if (stats.max === stats.min) return 0.5;
  let t = (Number(value) - stats.min) / (stats.max - stats.min);
  t = Math.max(0, Math.min(1, t));
  return higherIsBetter ? 1 - t : t;
}

function parseHex(hex) {
  const h = hex.replace('#', '').trim();
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Design tokens from getComputedStyle are often rgb(), not #hex. */
function colorToRgb(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  if (s.startsWith('#')) {
    const rgb = parseHex(s);
    if (rgb.every((c) => Number.isFinite(c))) return rgb;
    return null;
  }
  const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

function toHex([r, g, b]) {
  const c = (x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function lerpHex(a, b, t) {
  const A = colorToRgb(a);
  const B = colorToRgb(b);
  if (!A || !B) return typeof a === 'string' ? a : b;
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}

/** IBM-like cold→hot ramp using design tokens (theme-aware via CSS vars on document). */
export function heatColor(ratio, semantic) {
  if (ratio == null) return semantic.unknown;
  const t = Math.max(0, Math.min(1, ratio));
  return lerpHex(semantic.info, semantic.critical, t);
}