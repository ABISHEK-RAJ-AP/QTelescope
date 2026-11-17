/** Honest read-only label for GET /governance/notifications/config (no fake delivery). */
export function formatGovernNotifyConfig(cfg, { loadFailed = false } = {}) {
  if (loadFailed) {
    return { tone: 'warn', text: 'Notification config unavailable (check permissions or server config).' };
  }
  if (!cfg) {
    return { tone: 'muted', text: 'Notification config not loaded.' };
  }
  const events = cfg.events || [];
  const channels = cfg.channels || {};
  const enabled = Object.entries(channels)
    .filter(([, ch]) => ch?.enabled)
    .map(([name]) => name);
  if (!events.length) {
    return { tone: 'muted', text: 'Notifications not configured — no subscribed events in governance_notifications.json.' };
  }
  if (!enabled.length) {
    return {
      tone: 'warn',
      text: `${events.length} subscribed event(s) · all delivery channels disabled`,
    };
  }
  const emailStub = enabled.includes('email');
  const chLabel = enabled.join(', ');
  const stubNote = emailStub ? ' · email logs only until SMTP is wired' : '';
  return {
    tone: 'ok',
    text: `${events.length} subscribed event(s) · channels: ${chLabel}${stubNote}`,
  };
}