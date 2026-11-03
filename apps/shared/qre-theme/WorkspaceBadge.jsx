const WORKSPACES = {
  observe: { label: 'QRP', sub: 'Observe' },
  build: { label: 'QRP', sub: 'Build' },
  govern: { label: 'C-DAC', sub: 'Govern' },
};

/** Current workspace label only — no cross-app dropdown (avoids header layout shift). */
export default function WorkspaceBadge({ activeId = 'govern' }) {
  const active = WORKSPACES[activeId] || WORKSPACES.govern;
  return (
    <div className="qre-workspace-badge" aria-current="page">
      <span className="qre-workspace-badge__label">{active.label}</span>
      <span className="qre-workspace-badge__sub">{active.sub}</span>
    </div>
  );
}
