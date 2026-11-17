import React from 'react'
import { cn } from '@/lib/utils.js'
import './item.css'

export function ItemGroup({ className, ...props }) {
  return <div role="list" data-slot="item-group" className={cn('ui-item-group', className)} {...props} />
}

export function Item({
  className,
  variant = 'outline',
  size = 'default',
  tone,
  ...props
}) {
  return (
    <div
      data-slot="item"
      data-variant={variant}
      className={cn(
        'ui-item',
        `ui-item--${variant}`,
        `ui-item--size-${size}`,
        tone && `ui-item--${tone}`,
        className,
      )}
      {...props}
    />
  )
}

export function ItemMedia({ className, variant = 'icon', ...props }) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn('ui-item__media', `ui-item__media--${variant}`, className)}
      {...props}
    />
  )
}

export function ItemContent({ className, ...props }) {
  return <div data-slot="item-content" className={cn('ui-item__content', className)} {...props} />
}

export function ItemTitle({ className, ...props }) {
  return <div data-slot="item-title" className={cn('ui-item__title', className)} {...props} />
}

export function ItemDescription({ className, ...props }) {
  return <p data-slot="item-description" className={cn('ui-item__description', className)} {...props} />
}

export function ItemFooter({ className, ...props }) {
  return <div data-slot="item-footer" className={cn('ui-item__footer', className)} {...props} />
}

export function ItemMeta({ className, ...props }) {
  return <div className={cn('ui-item__meta', className)} {...props} />
}