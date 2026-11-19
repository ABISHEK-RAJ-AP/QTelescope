import { useEffect, useState } from 'react';
import { api } from '../services/api';

/** Server policy: whether /register is allowed (config-status, no auth). */
export function usePublicRegistration() {
  const [allowed, setAllowed] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getConfigStatus()
      .then((s) => {
        if (!cancelled) setAllowed(s?.allow_public_registration !== false);
      })
      .catch(() => {
        if (!cancelled) setAllowed(true);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  return { allowed, loaded };
}