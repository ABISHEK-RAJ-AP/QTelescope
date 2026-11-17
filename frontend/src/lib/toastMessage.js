/** Turn flat notify strings into { app, title, body, showMeta } for OperatorFeedItem. */
export function normalizeToastContent(message, variant = 'info') {
  if (message && typeof message === 'object' && !message.$$typeof) {
    return {
      showMeta: message.showMeta !== false,
      app: message.app || 'Console',
      title: message.title,
      body: message.body ?? null,
    }
  }

  const raw = String(message ?? '').trim()
  if (!raw) {
    return { app: 'Console', title: 'Done', body: null, showMeta: false }
  }

  const batch = raw.match(/^(Acknowledged|Resolved)\s+(\d+)\s+alert\(s\)(.*)$/i)
  if (batch) {
    const rest = (batch[3] || '').trim()
    return {
      app: 'Alerts',
      title: batch[1],
      body: `${batch[2]} alert${Number(batch[2]) === 1 ? '' : 's'} updated${rest ? ` ${rest.replace(/^;?\s*/, '· ')}` : ''}`,
      showMeta: true,
    }
  }

  const shortStatus =
    /^(acknowledged|resolved|saved|updated|posted|added|disabled|enabled|copied|downloaded|created|revoked)([.!])?$/i
  if (shortStatus.test(raw)) {
    const title = raw.replace(/[.!]+$/, '')
    return {
      app: variant === 'success' ? 'Alerts' : 'Console',
      title: title.charAt(0).toUpperCase() + title.slice(1),
      body: null,
      showMeta: true,
    }
  }

  const sentence = raw.match(/^(.{3,60}?)([.!])$/)
  if (sentence && !raw.includes('·') && raw.split(/\s+/).length <= 8) {
    return {
      app: 'Console',
      title: sentence[1],
      body: null,
      showMeta: true,
    }
  }

  return {
    app: 'Console',
    title: variant === 'success' ? 'Success' : variant === 'error' ? 'Error' : variant === 'warn' ? 'Warning' : 'Notice',
    body: raw,
    showMeta: true,
  }
}