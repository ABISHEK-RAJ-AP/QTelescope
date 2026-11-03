export default function HomeKpiStrip({ summary }) {
  if (!summary) return null;
  const cards = [
    { label: 'Projects', value: summary.project_count ?? 0 },
    { label: 'Sim jobs active', value: summary.sim_jobs_active ?? 0 },
    {
      label: 'Pending approvals',
      value: summary.pending_approvals == null ? '—' : summary.pending_approvals,
    },
    {
      label: 'Shots remaining (tenant)',
      value: summary.quota?.remaining_shots?.toLocaleString() ?? '—',
    },
  ];
  return (
    <div className="qre-kpi-grid">
      {cards.map((c) => (
        <div key={c.label} className="qre-kpi-card">
          <div className="qre-kpi-card__value">{c.value}</div>
          <div className="qre-kpi-card__label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
