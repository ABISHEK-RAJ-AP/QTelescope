const KEY = 'qre_studio_theme';

export function readTheme() {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'dark' || t === 'light' || t === 'high-contrast') return t;
  } catch {
    /* ignore */
  }
  return 'light';
}

export function resolveDataTheme(theme) {
  if (theme === 'high-contrast') return 'high-contrast';
  return theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme) {
  const data = resolveDataTheme(theme);
  document.documentElement.setAttribute('data-theme', data);
  document.documentElement.style.colorScheme = data === 'light' ? 'light' : 'dark';
}

export function setTheme(theme) {
  const n = theme === 'light' || theme === 'dark' || theme === 'high-contrast' ? theme : 'light';
  try {
    localStorage.setItem(KEY, n);
  } catch {
    /* ignore */
  }
  applyTheme(n);
  try {
    window.dispatchEvent(new CustomEvent('qre-theme-changed', { detail: { theme: n } }));
  } catch {
    /* ignore */
  }
  return n;
}

export function initTheme() {
  applyTheme(readTheme());
}
