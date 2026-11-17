import React from 'react'
import { AlertTriangle, Bell, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils.js'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemMedia,
  ItemMeta,
  ItemTitle,
} from './item.jsx'

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
  showMeta = true,
  itemVariant = 'outline',
}) {
  const Icon = IconProp || ICONS[variant] || Bell
  const detail = body ?? children
  const showDescription = Boolean(detail) && String(detail).trim() !== String(title || '').trim()
  const isToast = className.includes('qts-feed-item--toast')

  return (
    <Item
      variant={itemVariant}
      size="default"
      tone={variant}
      className={cn(isToast ? 'ui-item--toast' : '', className)}
    >
      <ItemMedia variant="icon">
        <Icon aria-hidden strokeWidth={2} />
      </ItemMedia>
      <ItemContent>
        {showMeta ? (
          <ItemMeta>
            <span>{app}</span>
            <span aria-hidden>·</span>
            <time>{time}</time>
          </ItemMeta>
        ) : null}
        {title ? <ItemTitle>{title}</ItemTitle> : null}
        {showDescription ? <ItemDescription>{detail}</ItemDescription> : null}
        {footer}
      </ItemContent>
      {!showMeta && time ? (
        <ItemFooter>
          <time>{time}</time>
        </ItemFooter>
      ) : null}
    </Item>
  )
}