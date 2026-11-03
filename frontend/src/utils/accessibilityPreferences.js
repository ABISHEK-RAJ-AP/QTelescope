const FONT_KEY = 'qtelescope_a11y_font';
const MOTION_KEY = 'qtelescope_a11y_reduce_motion';
const CONTRAST_KEY = 'qtelescope_a11y_high_contrast';

export const FONT_SCALES = [
  { id: '100', label: 'Default', value: 1 },
  { id: '112', label: 'Large', value: 1.12 },
  { id: '125', label: 'Extra large', value: 1.25 },
];

export function readFontScaleId() {
  try {
    const v = localStorage.getItem(FONT_KEY);
    if (FONT_SCALES.some((s) => s.id === v)) return v;
  } catch {
    /* ignore */
  }
  return '100';
}

export function writeFontScaleId(id) {
  try {
    localStorage.setItem(FONT_KEY, id);
  } catch {
    /* ignore */
  }
}

export function readReduceMotion() {
  try {
    return localStorage.getItem(MOTION_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeReduceMotion(on) {
  try {
    localStorage.setItem(MOTION_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function readHighContrast() {
  try {
    return localStorage.getItem(CONTRAST_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeHighContrast(on) {
  try {
    localStorage.setItem(CONTRAST_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function applyAccessibilityDocument(opts = {}) {
  const fontId = opts.fontScaleId ?? readFontScaleId();
  const scale = FONT_SCALES.find((s) => s.id === fontId)?.value ?? 1;
  const reduceMotion = opts.reduceMotion ?? readReduceMotion();
  const highContrast = opts.highContrast ?? readHighContrast();
  const root = document.documentElement;
  root.style.setProperty('--font-scale', String(scale));
  root.classList.toggle('a11y-reduce-motion', reduceMotion);
  root.classList.toggle('a11y-high-contrast', highContrast);
}
