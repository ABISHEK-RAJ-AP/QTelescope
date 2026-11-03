import { useEffect, useState } from 'react';
import { fetchAuthMe } from '@qre-theme/auth.js';
import { syncContextTenantId } from '@qre-theme/contextScope.js';

export function useGovernSession() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  function reload() {
    setLoading(true);
    fetchAuthMe()
      .then((body) => {
        if (body?.authenticated) {
          setMe(body);
          if (body.tenant_id) syncContextTenantId(body.tenant_id);
          sessionStorage.removeItem('qre_govern_dev');
        } else if (body?.dev_session) {
          setMe(body);
        } else {
          setMe(null);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    window.addEventListener('qre-role-changed', reload);
    return () => window.removeEventListener('qre-role-changed', reload);
  }, []);

  return { me, loading, permissions: me?.permissions || [], org: me?.org || '' };
}
