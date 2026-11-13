/** Client session lifecycle — cleared on logout, expiry, or API 401. */

export const SESSION_EXPIRED_EVENT = 'qts-session-expired';

export function readSessionUser() {
  try {
    const raw = localStorage.getItem('quantum_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem('quantum_user');
}

const AUTH_PUBLIC_PREFIXES = [
  '/auth/login',
  '/auth/login/mfa',
  '/auth/register',
  '/auth/captcha',
  '/auth/verify-captcha',
  '/auth/password/forgot',
  '/auth/password/reset',
  '/auth/logout',
];

export function isPublicAuthEndpoint(endpoint) {
  const path = endpoint?.split('?')[0] || '';
  return AUTH_PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function emitSessionExpired(reason = 'expired') {
  if (!readSessionUser()) return;
  clearSession();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { reason } }));
}
