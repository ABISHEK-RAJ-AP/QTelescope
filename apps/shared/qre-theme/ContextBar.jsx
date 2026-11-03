export default function ContextBar({ org, tenantId, projectSlot = null }) {
  if (!org && !tenantId && !projectSlot) return null;
  return (
    <div className="qre-context-bar" role="region" aria-label="Workspace context">
      {org && (
        <span className="qre-context-bar__chip">
          <span className="qre-context-bar__label">Org</span>
          {org}
        </span>
      )}
      {tenantId && (
        <span className="qre-context-bar__chip">
          <span className="qre-context-bar__label">Tenant</span>
          {tenantId}
        </span>
      )}
      {projectSlot}
    </div>
  );
}
