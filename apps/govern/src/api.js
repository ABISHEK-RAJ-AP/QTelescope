import { buildAuthHeaders } from '@qre-theme/auth.js';

const API = '/api/v1';

export function apiBase() {
  return API;
}

export function authHeaders() {
  return buildAuthHeaders();
}

export async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { detail: text };
  }
  if (!response.ok) {
    const error = new Error(typeof body?.detail === 'string' ? body.detail : response.statusText);
    error.status = response.status;
    throw error;
  }
  return body;
}
