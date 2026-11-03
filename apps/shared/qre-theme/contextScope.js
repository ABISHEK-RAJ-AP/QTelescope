/** Cross-SPA workspace context (tenant + optional project filter). */

export const PROJECT_CTX_KEY = 'qre_context_project_id';
export const TENANT_CTX_KEY = 'qre_context_tenant_id';

export function readContextProjectId() {
  try {
    return localStorage.getItem(PROJECT_CTX_KEY) || '';
  } catch {
    return '';
  }
}

export function writeContextProjectId(projectId) {
  try {
    if (projectId) localStorage.setItem(PROJECT_CTX_KEY, projectId);
    else localStorage.removeItem(PROJECT_CTX_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('qre-context-changed', { detail: { projectId: projectId || '' } }));
  } catch {
    /* ignore */
  }
}

export function readContextTenantId() {
  try {
    return localStorage.getItem(TENANT_CTX_KEY) || '';
  } catch {
    return '';
  }
}

export function syncContextTenantId(tenantId) {
  if (!tenantId) return;
  try {
    const prev = localStorage.getItem(TENANT_CTX_KEY);
    if (prev === tenantId) return;
    localStorage.setItem(TENANT_CTX_KEY, tenantId);
    window.dispatchEvent(new CustomEvent('qre-context-changed', { detail: { tenantId } }));
  } catch {
    /* ignore */
  }
}

export function filterByContextProject(items, projectId = readContextProjectId()) {
  if (!projectId) return items;
  return (items || []).filter((item) => item.project_id === projectId);
}
