/** Session helpers — aligned with main Observe app (`quantum_user` in localStorage). */

import { readContextTenantId } from './contextScope.js';

export function readSessionUser() {
  try {
    const raw = localStorage.getItem('quantum_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function buildAuthHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  const user = readSessionUser();
  if (user?.token) headers.Authorization = `Bearer ${user.token}`;
  if (user?.role) {
    headers['X-User-Role'] = user.role;
    if (user.username) headers['X-User-Name'] = user.username;
  } else {
    const role = localStorage.getItem('qre_role') || 'Researcher';
    headers['X-User-Role'] = role;
    headers['X-User-Name'] = localStorage.getItem('qre_user') || role;
  }
  const tenantHint = readContextTenantId();
  if (tenantHint) headers['X-Tenant-Id'] = tenantHint;
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('qre_govern_dev') === '1') {
    headers['X-QRE-Dev-Ack'] = '1';
  }
  return headers;
}

export async function fetchAuthMe(apiBase = '/api/v1') {
  const r = await fetch(`${apiBase}/auth/me`, { headers: buildAuthHeaders() });
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) clearSession();
    return { authenticated: false };
  }
  const body = await r.json();
  if (!body?.authenticated && readSessionUser()?.token) {
    clearSession();
    const retry = await fetch(`${apiBase}/auth/me`, { headers: buildAuthHeaders() });
    if (retry.ok) return retry.json();
    return { authenticated: false };
  }
  return body;
}

export function clearSession() {
  localStorage.removeItem('quantum_user');
  localStorage.removeItem('qre_role');
  localStorage.removeItem('qre_user');
}

/** True when API session or dev headers will be sent. */
export function hasPlatformSession() {
  return !!readSessionUser()?.token;
}

export function saveSessionUser(user) {
  localStorage.setItem('quantum_user', JSON.stringify(user));
  if (user?.role) localStorage.setItem('qre_role', user.role);
  if (user?.username) localStorage.setItem('qre_user', user.username);
  window.dispatchEvent(new CustomEvent('qre-role-changed', { detail: user?.role }));
}

export async function fetchCaptcha(apiBase = '/api/v1') {
  const r = await fetch(`${apiBase}/auth/captcha`);
  if (!r.ok) throw new Error('Could not load verification image — is the API running?');
  return r.json();
}

export async function loginWithCredentials(body, apiBase = '/api/v1') {
  const r = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || data.message || 'Sign-in failed');
  if (data.status !== 'SUCCESS' || !data.user?.token) throw new Error(data.message || 'Sign-in failed');
  let user = data.user;
  try {
    const me = await fetch(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    });
    if (me.ok) {
      const profile = await me.json();
      if (profile.authenticated) {
        user = { ...user, permissions: profile.permissions, role_label: profile.role_label, tenant_id: profile.tenant_id };
      }
    }
  } catch {
    /* login payload enough */
  }
  return user;
}

export async function registerWithCredentials(body, apiBase = '/api/v1') {
  const r = await fetch(`${apiBase}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || data.message || 'Registration failed');
  if (data.status !== 'SUCCESS') throw new Error(data.message || 'Registration failed');
  return data;
}
