import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium tracking-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0284c7]/35 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-45 dark:focus-visible:ring-[#38bdf8]/35 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-[#0284c7] text-white hover:bg-[#0369a1] dark:bg-[#0284c7] dark:text-white dark:hover:bg-[#0ea5e9]',
        outline:
          'border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-transparent dark:text-neutral-100 dark:hover:bg-neutral-800',
        ghost:
          'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800',
        secondary:
          'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-50 dark:hover:bg-neutral-700',
        soft:
          'bg-white text-neutral-950 shadow-sm dark:bg-neutral-850 dark:text-neutral-50',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 rounded-md px-2.5 text-[13px]',
        xs: 'h-7 rounded-md px-2 text-xs',
        lg: 'h-11 rounded-lg px-6 text-[0.95rem]',
        icon: 'h-8 w-8',
        'icon-sm': 'h-7 w-7 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export function Button({
  className,
  variant,
  size,
  title,
  'aria-label': ariaLabel,
  children,
  ...props
}) {
  const iconOnly = size === 'icon' || size === 'icon-sm'
  const label = ariaLabel ?? (iconOnly ? title : undefined)
  return (
    <button
      type="button"
      {...props}
      className={cn(buttonVariants({ variant, size, className }))}
      title={title}
      aria-label={label}
    >
      {children}
    </button>
  )
}
