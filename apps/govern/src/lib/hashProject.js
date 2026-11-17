import { readContextProjectId, writeContextProjectId } from '@qre-theme/contextScope.js';

/** Read `project` or `project_id` from a govern hash route (`#/queue?project=…`). */
export function projectIdFromHash(hash = '') {
  const raw = hash || (typeof window !== 'undefined' ? window.location.hash : '');
  if (!raw.includes('?')) return '';
  const qs = new URLSearchParams(raw.split('?')[1] || '');
  return (qs.get('project') || qs.get('project_id') || '').trim();
}

const CONTEXT_SCOPED_PATHS = new Set([
  '/queue',
  '/reservations',
  '/schedule/hold',
  '/holds',
  '/usage',
  '/quotas',
  '/audit',
  '/my-work',
]);

/** When hash carries a project id on a scoped route, pin govern context (idempotent). */
export function syncProjectContextFromHash(hash) {
  const path = (hash || '').replace(/^#/, '').split('?')[0];
  const projectId = projectIdFromHash(hash);
  if (!projectId || !CONTEXT_SCOPED_PATHS.has(path)) return;
  if (readContextProjectId() !== projectId) writeContextProjectId(projectId);
}

export function queueHashForProject(projectId, state = '') {
  const params = new URLSearchParams();
  if (projectId) params.set('project', projectId);
  if (state) params.set('state', state);
  const q = params.toString();
  return q ? `#/queue?${q}` : '#/queue';
}