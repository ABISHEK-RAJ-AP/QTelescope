import { useEffect, useState } from 'react';
import ContextBar from '@qre-theme/ContextBar.jsx';
import { fetchAuthMe } from '@qre-theme/auth.js';
import { syncContextTenantId } from '@qre-theme/contextScope.js';

export default function BuildContextBar({ projectName = null, projectId = null }) {
  const [me, setMe] = useState(null);

  useEffect(() => {
    fetchAuthMe().then((body) => {
      if (body?.authenticated) {
        setMe(body);
        if (body.tenant_id) syncContextTenantId(body.tenant_id);
      }
    });
    const onRole = () =>
      fetchAuthMe().then((body) => {
        if (body?.authenticated) setMe(body);
      });
    window.addEventListener('qre-role-changed', onRole);
    return () => window.removeEventListener('qre-role-changed', onRole);
  }, []);

  const projectSlot =
    projectId && projectName ? (
      <span className="qre-context-bar__chip">
        <span className="qre-context-bar__label">Project</span>
        {projectName}
      </span>
    ) : null;

  if (!me?.org && !me?.tenant_id && !projectSlot) return null;

  return <ContextBar org={me?.org} tenantId={me?.tenant_id} projectSlot={projectSlot} />;
}
