/** Maps builtin `permissions.py` role IDs to Overview layout lenses (no invented roles). */

export const PLATFORM_ADMIN_ROLES = new Set(['Admin', 'SuperAdmin', 'PlatformAdmin', 'QuantumOpsAdmin']);

export function resolveOverviewLens(role, permissions = []) {
  const r = role || 'Viewer';
  if (PLATFORM_ADMIN_ROLES.has(r)) return 'platform_admin';
  if (r === 'SecurityAdmin') return 'security';
  if (r === 'Auditor') return 'auditor';
  if (r === 'Researcher' || r === 'ResearchAnalyst') return 'researcher';
  if (r === 'Operator' || r === 'OpsEngineer' || r === 'IncidentCommander') return 'governance_ops';
  if (r === 'Viewer') return 'viewer';
  if (permissions.includes('approvals:decide')) return 'reviewer';
  return 'viewer';
}