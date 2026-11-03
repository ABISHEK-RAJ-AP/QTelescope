import { useEffect, useState } from 'react';
import { readContextProjectId } from '@qre-theme/contextScope.js';

export function useContextProjectId() {
  const [projectId, setProjectId] = useState(() => readContextProjectId());

  useEffect(() => {
    const sync = () => setProjectId(readContextProjectId());
    window.addEventListener('qre-context-changed', sync);
    return () => window.removeEventListener('qre-context-changed', sync);
  }, []);

  return projectId;
}
