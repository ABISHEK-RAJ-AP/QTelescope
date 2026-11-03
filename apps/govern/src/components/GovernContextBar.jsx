import { useEffect, useState } from 'react';
import { readContextProjectId, syncContextTenantId, writeContextProjectId } from '@qre-theme/contextScope.js';
import { api } from '../api.js';
import { projectOptionLabel } from '../lib/format.js';

/** Slim project filter — Cert Studio topbar tool, not Org/Tenant chips. */
export default function GovernContextBar({ me }) {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(() => readContextProjectId());

  useEffect(() => {
    api('/projects')
      .then((rows) => setProjects(Array.isArray(rows) ? rows : []))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (me?.tenant_id) syncContextTenantId(me.tenant_id);
  }, [me?.tenant_id]);

  useEffect(() => {
    const sync = () => setProjectId(readContextProjectId());
    window.addEventListener('qre-context-changed', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('qre-context-changed', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  if (!projects.length && !projectId) return null;

  return (
    <select
      className="govern-topbar-select"
      value={projectId}
      onChange={(e) => {
        writeContextProjectId(e.target.value);
        setProjectId(e.target.value);
      }}
      aria-label="Project filter"
    >
      <option value="">Project</option>
      {projects.map((row) => (
        <option key={row.project_id} value={row.project_id}>
          {projectOptionLabel(row)}
        </option>
      ))}
      {projectId && !projects.some((row) => row.project_id === projectId) ? (
        <option value={projectId}>{projectId}</option>
      ) : null}
    </select>
  );
}
