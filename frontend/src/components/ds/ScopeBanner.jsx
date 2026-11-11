import React from 'react';
import './scopeBanner.css';

/**
 * Explains what subset of data the operator is viewing (stored vs loaded vs filtered).
 */
export function ScopeBanner({ title = 'Data scope', items = [], variant = 'info', action = null, className = '' }) {
  if (!items.length && !action) return null;
  return (
    <div className={`scope-banner scope-banner--${variant} ${className}`.trim()} role="note" aria-label={title}>
      {items.length > 0 ? (
        <dl className="scope-banner__dl">
          {items.map((item) => (
            <div key={item.term} className="scope-banner__row">
              <dt>{item.term}</dt>
              <dd>{item.detail}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {action ? <div className="scope-banner__action">{action}</div> : null}
    </div>
  );
}
