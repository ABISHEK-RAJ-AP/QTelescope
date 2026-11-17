import React from 'react'
import { AlertTriangle, Bell, CheckCircle2, Info, XCircle } from 'lucide-react'

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warn: AlertTriangle,
  info: Info,
  critical: XCircle,
}

export function OperatorFeedItem({
  app = 'Console',
  title,
  body,
  children,
  variant = 'info',
  time = 'now',
  icon: IconProp,
  footer = null,
  className = '',
}) {
  const Icon = IconProp || ICONS[variant] || Bell
  const detail = body ?? children
  return (
    <article className={`qts-feed-item qts-feed-item--${variant} ${className}`.trim()} data-variant={variant}>
      <div className="qts-feed-item__media" aria-hidden>
        <Icon className="qts-feed-item__icon" size={18} strokeWidth={2} />
      </div>
      <div className="qts-feed-item__content">
        <div className="qts-feed-item__meta">
          <span className="qts-feed-item__app">{app}</span>
          <span className="qts-feed-item__dot" aria-hidden>·</span>
          <time className="qts-feed-item__time">{time}</time>
        </div>
        {title ? <h3 className="qts-feed-item__title">{title}</h3> : null}
        {detail ? <p className="qts-feed-item__body">{detail}</p> : null}
        {footer}
      </div>
    </article>
  )
}