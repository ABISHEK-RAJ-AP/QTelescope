import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Eye, Siren } from 'lucide-react';
import './AlertsEvents.css';

const SEV_ICON = { CRITICAL: AlertTriangle, WARNING: AlertCircle, INFO: Info };
const SEV_CLASS = { CRITICAL: 'badge-critical', WARNING: 'badge-warning', INFO: 'badge-info' };

/** Severity badge: icon + text, never color alone. */
export function SevBadge({ severity }) {
  const Icon = SEV_ICON[severity] || Info;
  return (
    <span className={`badge ${SEV_CLASS[severity] || 'badge-info'} ops-badge`}>
      <Icon size={12} aria-hidden /> {severity || 'UNKNOWN'}
    </span>
  );
}

const STATUS_ICON = {
  ACTIVE: Siren, OPEN: Siren, ACKNOWLEDGED: Eye, INVESTIGATING: Eye, RESOLVED: CheckCircle2,
};
const STATUS_CLASS = {
  ACTIVE: 'badge-offline', OPEN: 'badge-offline', ACKNOWLEDGED: 'badge-warning',
  INVESTIGATING: 'badge-info', RESOLVED: 'badge-healthy',
};

export function StatusBadge({ status }) {
  const Icon = STATUS_ICON[status] || Info;
  return (
    <span className={`badge ${STATUS_CLASS[status] || 'badge-info'} ops-badge`}>
      <Icon size={12} aria-hidden /> {status || '—'}
    </span>
  );
}

/** RBAC role label on discussion threads (Cert Studio–style attribution). */
export function RoleBadge({ role }) {
  if (!role) return null;
  return <span className="rbac-role-badge">{role}</span>;
}
