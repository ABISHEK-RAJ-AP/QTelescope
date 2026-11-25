import React, { useId } from 'react';
import './entityFlipCard.css';

/**
 * Two-sided summary card — click-only flip (not hover). Reduced-motion expands back face inline.
 */
export function EntityFlipCard({
  className = '',
  flipped = false,
  onFlip,
  severity,
  selected = false,
  ariaLabel,
  front,
  back,
  footer,
}) {
  const backId = useId();
  return (
    <article
      className={`eflip card-density${className ? ` ${className}` : ''}${flipped ? ' is-open' : ''}`}
      data-severity={severity || undefined}
      data-selected={selected || undefined}
      aria-label={ariaLabel}
    >
      <div className="eflip__stage">
        <div className="eflip__inner">
          <div className="eflip__face eflip__face--front">{front}</div>
          <div className="eflip__face eflip__face--back" id={backId}>
            {back}
          </div>
        </div>
      </div>
      {footer ? <footer className="eflip__foot">{footer}</footer> : null}
      {onFlip ? (
        <button
          type="button"
          className="eflip__flip btn btn-secondary btn--sm"
          aria-expanded={flipped}
          aria-controls={backId}
          onClick={onFlip}
        >
          {flipped ? 'Show summary' : 'Technical details'}
        </button>
      ) : null}
    </article>
  );
}