import { StatusBadge, WorkloadLink } from '../components/ui.jsx';

export function waitLabel(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '—';
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}m`;
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function approvalGridFields(onOpen, { actionLabel = 'Review', showWaiting = false, showSubmitted = false } = {}) {
  const fields = [
    {
      id: 'status',
      label: 'Status',
      wide: true,
      render: (item) => <StatusBadge state={item.governance_state} />,
    },
    {
      id: 'workload',
      label: 'Workload',
      wide: true,
      render: (item) => (
        <>
          <WorkloadLink workloadId={item.workload_id} onOpen={onOpen} />
          <span className="govern-table__sub">{item.created_by}</span>
        </>
      ),
    },
    {
      id: 'requester',
      label: 'Requester',
      render: (item) => item.created_by || '—',
    },
    {
      id: 'stage',
      label: 'Stage',
      render: (item) => {
        const stage = item.governance_progress?.current_stage?.label || 'Review';
        const index = (item.governance_progress?.stage_index ?? 0) + 1;
        const total = item.governance_progress?.stage_total || 1;
        return (
          <>
            {stage}
            <span className="govern-table__sub">
              Stage {index} of {total}
            </span>
          </>
        );
      },
    },
  ];
  if (showWaiting) {
    fields.push({ id: 'waiting', label: 'Waiting', render: (item) => waitLabel(item.created_at) });
  }
  if (showSubmitted) {
    fields.push({
      id: 'submitted',
      label: 'Submitted',
      render: (item) => (item.created_at ? new Date(item.created_at).toLocaleString() : '—'),
    });
  }
  fields.push({
    id: 'actions',
    label: 'Actions',
    wide: true,
    render: (item) => (
      <button
        type="button"
        className="qre-btn qre-btn--primary"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(`#/queue/${item.workload_id}`);
        }}
      >
        {actionLabel}
      </button>
    ),
  });
  return fields;
}
