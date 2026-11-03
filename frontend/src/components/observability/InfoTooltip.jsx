import React, { useEffect, useId, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Accessible help popover (hover, focus, click-to-pin). Trigger is a span — safe inside labels/cards (not nested <button>).
 */
export function InfoTooltip({ label = 'More information', children, className = '' }) {
  const id = useId();
  const tipId = `tip-${id.replace(/:/g, '')}`;
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open && !pinned) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, pinned]);

  useEffect(() => {
    if (!pinned) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pinned]);

  const show = open || pinned;

  const togglePin = (e) => {
    e.stopPropagation();
    setPinned((p) => !p);
    setOpen(true);
  };

  const onTriggerKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      togglePin(e);
    }
  };

  return (
    <span
      ref={rootRef}
      className={`info-tooltip ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { if (!pinned) setOpen(false); }}
    >
      <span
        role="button"
        tabIndex={0}
        className="info-tooltip__trigger"
        aria-label={label}
        aria-expanded={show}
        aria-controls={tipId}
        onFocus={() => setOpen(true)}
        onBlur={() => { if (!pinned) setOpen(false); }}
        onClick={togglePin}
        onKeyDown={onTriggerKeyDown}
      >
        <HelpCircle size={14} aria-hidden />
      </span>
      {show && (
        <div id={tipId} role="tooltip" className={`info-tooltip__panel${pinned ? ' info-tooltip__panel--pinned' : ''}`}>
          {children}
          {pinned && (
            <div className="info-tooltip__pin-hint">Pinned — Esc to close</div>
          )}
        </div>
      )}
    </span>
  );
}
