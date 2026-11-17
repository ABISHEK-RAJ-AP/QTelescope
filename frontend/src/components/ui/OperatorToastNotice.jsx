import React from 'react';
import { OperatorFeedItem } from './OperatorFeedItem.jsx';

export function OperatorToastNotice({
  title,
  body,
  variant = 'info',
  actions = [],
  onAction,
  onRemindLater,
}) {
  const primary = actions.find((a) => a.href && !a.dismiss);
  const secondary = actions.filter((a) => a !== primary);

  const foot = (
    <div className="qts-toast-notice__foot">
        {primary ? (
          <button
            type="button"
            className="btn btn-primary qts-toast-notice__action"
            onClick={() => onAction?.(primary)}
          >
            {primary.label}
          </button>
        ) : null}
        {secondary.map((a) => (
          <button
            key={a.id || a.label}
            type="button"
            className="btn btn-secondary qts-toast-notice__action"
            onClick={() => onAction?.(a)}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-secondary qts-toast-notice__action qts-toast-notice__action--quiet"
          onClick={onRemindLater}
        >
          Remind later
        </button>
      </div>
  );

  return (
    <OperatorFeedItem
      app="Console"
      variant={variant}
      title={title}
      body={body}
      footer={foot}
      className="qts-feed-item--toast ui-item--toast"
      showMeta
    />
  );
}
