import { useEffect } from 'react';
import { syncGovernServerNotices } from '../lib/governServerFeed.js';

const POLL_MS = 45_000;

/** Keeps server-sourced govern notices in sync (queue, pending approvals). */
export default function GovernNotificationSync({ enabled, permissions }) {
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      syncGovernServerNotices(permissions).catch(() => {});
    };
    run();
    const timer = window.setInterval(run, POLL_MS);
    const onRefresh = () => run();
    window.addEventListener('qre-context-changed', onRefresh);
    window.addEventListener('qre-role-changed', onRefresh);
    window.addEventListener('govern:data-refresh', onRefresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('qre-context-changed', onRefresh);
      window.removeEventListener('qre-role-changed', onRefresh);
      window.removeEventListener('govern:data-refresh', onRefresh);
    };
  }, [enabled, permissions]);

  return null;
}