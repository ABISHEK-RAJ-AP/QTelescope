import React from 'react'
import { OperatorFeedItem } from './OperatorFeedItem.jsx'

/** Flat string or structured { app, title, body }. */
export function SimpleToastBody({ variant = 'info', children, app, title, body }) {
  if (typeof children === 'string' && !title && !body) {
    const m = children.match(/^(Acknowledged|Resolved)\s+(\d+)\s+alert\(s\)(.*)$/i)
    if (m) {
      const rest = (m[3] || '').trim()
      return (
        <OperatorFeedItem
          app="Alerts"
          variant={variant}
          title={m[1]}
          body={`${m[2]} alert${Number(m[2]) === 1 ? '' : 's'} updated${rest ? ` ${rest}` : ''}`}
        />
      )
    }
  }
  const detail = body ?? (typeof children === 'string' ? children : null)
  if (title || app) {
    return (
      <OperatorFeedItem app={app || 'Console'} variant={variant} title={title} body={detail} />
    )
  }
  return (
    <OperatorFeedItem
      app="Console"
      variant={variant}
      title={variant === 'success' ? 'Done' : variant === 'error' ? 'Error' : variant === 'warn' ? 'Warning' : 'Notice'}
      body={detail}
    />
  )
}