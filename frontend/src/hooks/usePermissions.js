import { useMemo } from 'react';
import { can } from '../lib/permissions.js';

export function usePermissions(currentUser) {
  return useMemo(() => ({
    can: (perm) => can(currentUser, perm),
    canAckAlerts: can(currentUser, 'alerts:acknowledge'),
    canResolveAlerts: can(currentUser, 'alerts:resolve'),
    canComment: can(currentUser, 'incidents:comment') || can(currentUser, 'alerts:comment'),
    canManageIncidents: can(currentUser, 'incidents:update'),
    canResolveIncidents: can(currentUser, 'incidents:resolve'),
    canManageUsers: can(currentUser, 'users:read'),
    canManageSecurity: can(currentUser, 'security:manage'),
  }), [currentUser]);
}
