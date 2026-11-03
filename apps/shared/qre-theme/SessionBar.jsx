import { useEffect, useState } from 'react';
import { fetchAuthMe } from './auth.js';

/** Compact topbar session chip — full account actions live in the sidebar footer. */
export default function SessionBar() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    fetchAuthMe().then((body) => setMe(body?.authenticated ? body : null));
    const onRole = () => fetchAuthMe().then((body) => setMe(body?.authenticated ? body : null));
    window.addEventListener('qre-role-changed', onRole);
    return () => window.removeEventListener('qre-role-changed', onRole);
  }, []);

  if (!me?.authenticated) return null;

  return (
    <div className="qre-session-bar" title={me.permissions?.length ? `${me.permissions.length} permissions` : ''}>
      <span className="qre-session-bar__name">{me.full_name || me.username}</span>
      <span className="qre-session-bar__role">{me.role_label || me.role}</span>
    </div>
  );
}
