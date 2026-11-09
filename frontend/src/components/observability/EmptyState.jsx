import React from 'react';
import { Inbox } from 'lucide-react';
import { EMPTY_DEFAULTS } from '../../constants/messages.js';

export function EmptyState({
  title = EMPTY_DEFAULTS.title,
  message = EMPTY_DEFAULTS.message,
  hint,
  action,
  icon: Icon = Inbox,
  variant = 'default',
  compact = false,
  align = 'center',
}) {
  const className = [
    'obs-empty',
    variant === 'panel' ? 'obs-empty--panel' : '',
    variant === 'inline' ? 'obs-empty--inline' : '',
    compact ? 'obs-empty--compact' : '',
    align === 'start' ? 'obs-empty--align-start' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={className} role="status">
      <Icon size={compact ? 22 : 28} className="obs-empty__icon" aria-hidden />
      <div className="obs-empty__text">
        <div className="obs-empty__title">{title}</div>
        <p className="obs-empty__message">{message}</p>
        {hint && <p className="obs-empty__hint">{hint}</p>}
        {action && <div className="obs-empty__action">{action}</div>}
      </div>
    </div>
  );
}

/** Empty row inside `.custom-table` */
export function TableEmpty({ colSpan, title, message, hint }) {
  return (
    <tr className="obs-table-empty-row">
      <td colSpan={colSpan}>
        <EmptyState variant="inline" compact title={title} message={message} hint={hint} align="start" />
      </td>
    </tr>
  );
}
