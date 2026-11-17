import { labelState } from '../labels.js';

/**
 * Role-specific operational KPI strip — one row, API-backed counts only.
 * @param {'platform_admin'|'governance_ops'|'researcher'|'reviewer'|'auditor'|'security'|'viewer'} lens
 */
export function buildOverviewKpis({ lens, data, myCount, permissions, onOpen }) {
  const canMeter = permissions.includes('metering:read') || permissions.includes('reports:read');
  const canDecide = permissions.includes('approvals:decide');
  const queue = data?.queue ?? 0;
  const counts = data?.counts || {};

  const waiting = {
    key: 'waiting',
    label: 'Waiting',
    value: queue,
    hint: 'Open queue',
    onClick: () => onOpen('#/queue'),
  };
  const mine = {
    key: 'mine',
    label: 'My work',
    value: myCount,
    hint: 'Assigned to you',
    onClick: () => onOpen('#/my-work'),
  };

  switch (lens) {
    case 'researcher':
      return [
        waiting,
        mine,
        {
          key: 'changes_requested',
          label: labelState('changes_requested'),
          value: counts.changes_requested ?? 0,
          hint: 'Filter queue',
          tone: 'govern-kpi--tone-warn',
          onClick: () => onOpen('#/queue?state=changes_requested'),
        },
        {
          key: 'approved',
          label: labelState('approved'),
          value: counts.approved ?? 0,
          hint: 'Filter queue',
          tone: 'govern-kpi--tone-ok',
          onClick: () => onOpen('#/queue?state=approved'),
        },
      ];
    case 'reviewer':
      return [
        waiting,
        {
          key: 'in_review',
          label: labelState('in_review'),
          value: counts.in_review ?? 0,
          hint: 'Filter queue',
          tone: 'govern-kpi--tone-warn',
          onClick: () => onOpen('#/queue?state=in_review'),
        },
        {
          key: 'changes_requested',
          label: labelState('changes_requested'),
          value: counts.changes_requested ?? 0,
          hint: 'Filter queue',
          tone: 'govern-kpi--tone-warn',
          onClick: () => onOpen('#/queue?state=changes_requested'),
        },
        mine,
      ];
    case 'auditor':
      return [
        waiting,
        {
          key: 'approved',
          label: labelState('approved'),
          value: counts.approved ?? 0,
          hint: 'Approved workloads',
          tone: 'govern-kpi--tone-ok',
          onClick: () => onOpen('#/queue?state=approved'),
        },
        {
          key: 'in_review',
          label: labelState('in_review'),
          value: counts.in_review ?? 0,
          hint: 'Open audit trail',
          onClick: () => onOpen('#/audit'),
        },
      ];
    case 'security':
      return [
        {
          key: 'submitted',
          label: labelState('submitted_for_review'),
          value: counts.submitted_for_review ?? 0,
          hint: 'Governance queue',
          onClick: () => onOpen('#/queue?state=submitted_for_review'),
        },
        {
          key: 'in_review',
          label: labelState('in_review'),
          value: counts.in_review ?? 0,
          hint: 'Audit trail',
          onClick: () => onOpen('#/audit'),
        },
        waiting,
      ];
    case 'viewer':
      return [
        waiting,
        {
          key: 'assets',
          label: 'Assets',
          value: data?.inventory_assets ?? 0,
          hint: 'Inventory',
          onClick: () => onOpen('#/inventory'),
        },
      ];
    case 'governance_ops':
      return [
        waiting,
        {
          key: 'providers',
          label: 'Active providers',
          value: data?.providers_active ?? 0,
          hint: `${data?.providers_total ?? 0} in catalogue`,
          onClick: () => onOpen('#/providers'),
        },
        {
          key: 'assets',
          label: 'Assets',
          value: data?.inventory_assets ?? 0,
          hint: 'Inventory',
          onClick: () => onOpen('#/inventory'),
        },
        ...(canMeter
          ? [{
              key: 'meters',
              label: 'Connector samples (24h)',
              value: data?.meter_samples_24h ?? 0,
              hint: 'Meter rollups · not shot ledger',
              onClick: () => onOpen('#/usage'),
            }]
          : []),
      ];
    case 'platform_admin':
    default:
      return [
        waiting,
        {
          key: 'in_review',
          label: labelState('in_review'),
          value: counts.in_review ?? 0,
          hint: 'Filter queue',
          tone: 'govern-kpi--tone-warn',
          onClick: () => onOpen('#/queue?state=in_review'),
        },
        {
          key: 'providers',
          label: 'Active providers',
          value: data?.providers_active ?? 0,
          hint: `${data?.providers_total ?? 0} in catalogue`,
          onClick: () => onOpen('#/providers'),
        },
        ...(canMeter
          ? [{
              key: 'meters',
              label: 'Connector samples (24h)',
              value: data?.meter_samples_24h ?? 0,
              hint: 'Meter rollups · not shot ledger',
              onClick: () => onOpen('#/usage'),
            }]
          : []),
        ...(canDecide ? [mine] : []),
      ];
  }
}