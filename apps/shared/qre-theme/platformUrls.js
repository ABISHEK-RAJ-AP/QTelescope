/** Cross-app navigation (dev: multiple Vite ports; prod: same origin). */

function host() {
  if (typeof window === 'undefined') return 'localhost';
  return window.location.hostname || 'localhost';
}

function observeOrigin() {
  if (typeof window === 'undefined') return '';
  const port = window.location.port;
  if (port === '5174' || port === '5175') {
    return `${window.location.protocol}//${host()}:5173`;
  }
  return window.location.origin;
}

export function observeUrl(path = '/app/overview') {
  const base = observeOrigin();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildUrl(path = '/build/') {
  if (typeof window === 'undefined') return path;
  const port = window.location.port;
  if (port === '5173' || port === '5175') {
    return `${window.location.protocol}//${host()}:5174${path.startsWith('/') ? path : `/${path}`}`;
  }
  return path.startsWith('/') ? path : `/${path}`;
}

export function governUrl(path = '/govern/') {
  if (typeof window === 'undefined') return path;
  const port = window.location.port;
  if (port === '5173' || port === '5174') {
    return `${window.location.protocol}//${host()}:5175${path.startsWith('/') ? path : `/${path}`}`;
  }
  return path.startsWith('/') ? path : `/${path}`;
}

export function loginUrl() {
  return observeUrl('/login');
}

export function registerUrl() {
  return observeUrl('/register');
}

/** Per-app sign-in (Govern / Forge inline gate; Observe → /login). */
export function redirectToAppLogin() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('qre_govern_dev');
  const port = window.location.port;
  const path = window.location.pathname || '';
  if (port === '5175' || path.includes('/govern')) {
    const hash = window.location.hash || '';
    window.location.href = hash.includes('register') ? `${governUrl('/govern/')}#/register` : `${governUrl('/govern/')}#/sign-in`;
    return;
  }
  if (port === '5174' || path.includes('/build')) {
    window.location.href = buildUrl('/build/');
    return;
  }
  sessionStorage.setItem('qre_post_login_redirect', window.location.href);
  window.location.href = loginUrl();
}

export function redirectToLogin() {
  redirectToAppLogin();
}
