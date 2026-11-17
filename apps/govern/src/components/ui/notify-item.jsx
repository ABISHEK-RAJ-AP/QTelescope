/** Item-row pattern (shadcn Item outline) — JS, no Radix. */

export function NotifyItemGroup({ className = '', children, ...props }) {
  return (
    <div role="list" className={`qre-notify-item-group ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function NotifyItem({
  tone = 'ok',
  app,
  title,
  description,
  time,
  unread,
  footer,
  source,
  onDismiss,
  className = '',
}) {
  return (
    <article
      role="listitem"
      className={`qre-notify-item qre-notify-item--${tone} ${className}`.trim()}
      data-tone={tone}
      data-source={source || undefined}
    >
      <div className="qre-notify-item__media" aria-hidden>
        <span className={`qre-notify-item__dot qre-notify-item__dot--${tone}`} />
      </div>
      <div className="qre-notify-item__content">
        <div className="qre-notify-item__meta">
          <span className="qre-notify-item__app">{app}</span>
          {time ? <time className="qre-notify-item__time">{time}</time> : null}
          {unread ? <span className="qre-notify-item__unread" aria-label="Unread" /> : null}
        </div>
        <h4 className="qre-notify-item__title">{title}</h4>
        {description ? <p className="qre-notify-item__desc">{description}</p> : null}
        {footer ? <div className="qre-notify-item__foot">{footer}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" className="qre-notify-item__dismiss" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      ) : null}
    </article>
  );
}