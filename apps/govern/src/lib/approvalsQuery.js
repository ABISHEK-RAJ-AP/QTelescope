/** Build `/approvals` list query from govern UI filters. */
export function approvalsListPath({ state = '', scope = '', projectId = '' } = {}) {
  const params = new URLSearchParams();
  if (state) params.set('state', state);
  if (scope) params.set('scope', scope);
  if (projectId) params.set('project_id', projectId);
  const q = params.toString();
  return q ? `/approvals?${q}` : '/approvals';
}

export function governanceSummaryPath(projectId = '') {
  if (!projectId) return '/governance/summary';
  return `/governance/summary?project_id=${encodeURIComponent(projectId)}`;
}

export function governanceActivityPath(projectId = '', limit = 200) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (projectId) params.set('project_id', projectId);
  return `/governance/activity?${params.toString()}`;
}
