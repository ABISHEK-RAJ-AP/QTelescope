/** Accessibility preferences (UI pattern borrowed from Cert Studio). */

export const A11Y_STORAGE_KEY = 'qtelescope_ceg_a11y';
export const LANG_STORAGE_KEY = 'qtelescope_ceg_lang';

export const A11Y_DEFAULTS = {
  contrast: 'normal',
  fontSize: 100,
  textSpacing: false,
  lineHeight: false,
  dyslexia: false,
  focusMode: false,
  pauseAnim: false,
  bigCursor: false,
  adhdMode: false,
  highlightLinks: false,
  hideImages: false,
  textToSpeech: false,
  disableWebGLBackground: false,
  onScreenKeyboard: false,
};

export const UI_LANGUAGES = [
  { code: 'en', label: 'English', englishLabel: 'English' },
  { code: 'hi', label: 'हिन्दी', englishLabel: 'Hindi' },
  { code: 'ta', label: 'தமிழ்', englishLabel: 'Tamil' },
  { code: 'te', label: 'తెలుగు', englishLabel: 'Telugu' },
  { code: 'bn', label: 'বাংলা', englishLabel: 'Bengali' },
  { code: 'mr', label: 'मराठी', englishLabel: 'Marathi' },
];

export function loadA11yPrefs() {
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return { ...A11Y_DEFAULTS };
    return { ...A11Y_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...A11Y_DEFAULTS };
  }
}

export function saveA11yPrefs(settings) {
  try {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function loadUiLang() {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) || 'en';
  } catch {
    return 'en';
  }
}

export function saveUiLang(code) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, code);
    window.dispatchEvent(new CustomEvent('qtelescope-lang-changed', { detail: { code } }));
  } catch {
    /* ignore */
  }
}

export function initA11yFromStorage() {
  applyA11ySettings(loadA11yPrefs());
}

export function getUiLangLabel(code) {
  const lang = UI_LANGUAGES.find((l) => l.code === code);
  if (!lang) return 'Language';
  return lang.code === 'en' ? lang.label : lang.englishLabel;
}

function systemPrefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function applyA11ySettings(settings) {
  const s = { ...A11Y_DEFAULTS, ...settings };
  const { body, documentElement: html } = document;
  const appRoot = document.getElementById('root');

  // 70–170% → rem cascade (html font-size uses --font-scale without a hard 20px ceiling)
  const scale = Math.min(1.7, Math.max(0.7, (Number(s.fontSize) || 100) / 100));
  html.style.setProperty('--font-scale', String(scale));

  const reduceMotion = Boolean(s.pauseAnim) || systemPrefersReducedMotion();
  body.classList.toggle('_access_pause_anim', reduceMotion);
  html.classList.toggle('a11y-reduce-motion', reduceMotion);
  body.classList.toggle('_access_focus_mode', Boolean(s.focusMode));
  body.classList.toggle('_access_big_cursor', Boolean(s.bigCursor));
  html.classList.toggle('a11y-big-cursor-on', Boolean(s.bigCursor));
  body.classList.toggle('_access_links', Boolean(s.highlightLinks));
  body.classList.toggle('_access_adhd_mode', Boolean(s.adhdMode));
  body.classList.toggle('_access_dyslexia', Boolean(s.dyslexia));
  body.classList.toggle('_access_text_spacing', Boolean(s.textSpacing));
  body.classList.toggle('_access_line_height', Boolean(s.lineHeight));
  body.classList.toggle('_access_hide_images', Boolean(s.hideImages));

  // Contrast filters go on #root (not <html>) so position:fixed chrome / OSK stay sharp.
  const contrastTargets = [html, appRoot].filter(Boolean);
  for (const el of contrastTargets) {
    el.classList.remove('a11y-contrast-high', 'a11y-contrast-gray', 'a11y-contrast-dark');
  }
  const contrastClass =
    s.contrast === 'high'
      ? 'a11y-contrast-high'
      : s.contrast === 'gray'
        ? 'a11y-contrast-gray'
        : s.contrast === 'dark'
          ? 'a11y-contrast-dark'
          : null;
  if (contrastClass === 'a11y-contrast-high') {
    html.classList.add(contrastClass); // variable overrides
  } else if (contrastClass && appRoot) {
    appRoot.classList.add(contrastClass); // grayscale / desaturate filters
  } else if (contrastClass) {
    html.classList.add(contrastClass);
  }

  const freezeWebGl = Boolean(s.disableWebGLBackground) || reduceMotion;
  html.toggleAttribute('data-a11y-webgl-off', freezeWebGl);
  html.toggleAttribute('data-a11y-osk', Boolean(s.onScreenKeyboard));

  try {
    window.dispatchEvent(new CustomEvent('qtelescope-a11y-changed', { detail: s }));
  } catch {
    /* ignore */
  }

  return s;
}
