import React from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warn: AlertTriangle,
  info: Info,
}

export function SimpleToastBody({ variant = 'info', children }) {
  const Icon = ICONS[variant] || Info
  return (
    <div className="qts-toast-simple">
      <Icon className="qts-toast-simple__icon" aria-hidden />
      <p className="qts-toast-simple__text">{children}</p>
    </div>
  )
}