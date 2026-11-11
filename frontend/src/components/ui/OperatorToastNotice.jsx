import React from 'react';

export function OperatorToastNotice({
  title,
  body,
  actions = [],
  onAction,
  onRemindLater,
}) {
  const primary = actions.find((a) => a.href && !a.dismiss);
  const secondary = actions.filter((a) => a !== primary);

  return (
    <div className="qts-toast-notice" role="status">
      {title ? <p className="qts-toast-notice__title">{title}</p> : null}
      <p className="qts-toast-notice__body">{body}</p>
      <div className="qts-toast-notice__foot">
        {primary ? (
          <button
            type="button"
            className="btn btn-primary btn--xs qts-toast-notice__cta"
            onClick={() => onAction?.(primary)}
          >
            {primary.label}
          </button>
        ) : null}
        {secondary.map((a) => (
          <button
            key={a.id || a.label}
            type="button"
            className="btn btn-secondary btn--xs"
            onClick={() => onAction?.(a)}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-secondary btn--xs qts-toast-notice__later"
          onClick={onRemindLater}
        >
          Remind later
        </button>
      </div>
    </div>
  );
}
