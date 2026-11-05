/** Only same-origin /app paths — blocks open redirects via sessionStorage. */
export function safePostLoginRedirect(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith('/app') && !value.startsWith('//') && !value.includes('://')) {
    return value;
  }
  try {
    const u = new URL(value, window.location.origin);
    if (u.origin === window.location.origin && u.pathname.startsWith('/app')) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}
