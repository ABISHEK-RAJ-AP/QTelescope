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
  className: classNameProp,
}) {
  const className = [
    'obs-empty',
    variant === 'panel' ? 'obs-empty--panel' : '',
    variant === 'inline' ? 'obs-empty--inline' : '',
    compact ? 'obs-empty--compact' : '',
    align === 'start' ? 'obs-empty--align-start' : '',
    classNameProp,
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

const emptyInlineProps = (props) => ({
  variant: 'inline',
  compact: true,
  align: props.align ?? 'start',
  title: props.title,
  message: props.message,
  hint: props.hint,
  action: props.action,
});

/** `as="row"` (default): `<tbody>` only. `as="block"`: panels, grids, collapsible bodies. */
export function TableEmpty({
  colSpan = 1,
  title,
  message,
  hint,
  action,
  as = 'row',
  align = 'start',
  centered = false,
}) {
  const body = (
    <EmptyState
      {...emptyInlineProps({ title, message, hint, action, align: centered ? 'center' : align })}
      className={centered ? 'obs-empty--table-centered' : undefined}
    />
  );

  if (as === 'block') {
    return <div className="obs-table-empty-block">{body}</div>;
  }

  return (
    <tr className="obs-table-empty-row">
      <td colSpan={colSpan}>{body}</td>
    </tr>
  );
}
