import React from 'react'
import { OperatorFeedItem } from './OperatorFeedItem.jsx'
import { normalizeToastContent } from '../../lib/toastMessage.js'

/** Flat string or structured { app, title, body, showMeta }. */
export function SimpleToastBody({ variant = 'info', children, app, title, body, showMeta }) {
  const merged =
    title || body || app
      ? { app, title, body: body ?? children, showMeta, variant }
      : { ...normalizeToastContent(children, variant), variant }
  return (
    <OperatorFeedItem
      app={merged.app || 'Console'}
      variant={variant}
      title={merged.title}
      body={merged.body}
      showMeta={merged.showMeta}
      className="qts-feed-item--toast ui-item--toast"
    />
  )
}