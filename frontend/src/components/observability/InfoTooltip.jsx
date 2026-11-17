import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

function placePanel(triggerEl, panelEl) {
  if (!triggerEl) return { top: 0, left: 0, maxWidth: 320 };
  const tr = triggerEl.getBoundingClientRect();
  const pw = panelEl?.offsetWidth || Math.min(320, window.innerWidth - 16);
  const ph = panelEl?.offsetHeight || 120;
  const margin = 8;
  const gap = 6;
  let top = tr.bottom + gap;
  if (top + ph > window.innerHeight - margin && tr.top - gap - ph > margin) {
    top = tr.top - gap - ph;
  }
  let left = tr.right - pw;
  if (left < margin) left = tr.left;
  if (left + pw > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - pw - margin);
  }
  return { top, left, maxWidth: Math.min(320, window.innerWidth - margin * 2) };
}

/**
 * Accessible help popover (hover, focus, click-to-pin). Panel portals to body so sidebar/card overflow cannot clip it.
 */
export function InfoTooltip({ label = 'More information', children, className = '', align = 'end' }) {
  const id = useId();
  const tipId = `tip-${id.replace(/:/g, '')}`;
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [coords, setCoords] = useState(null);

  const show = open || pinned;

  const reposition = useCallback(() => {
    if (!show) return;
    const next = placePanel(triggerRef.current, panelRef.current);
    if (align === 'start' && triggerRef.current) {
      const tr = triggerRef.current.getBoundingClientRect();
      next.left = Math.max(8, tr.left);
    }
    setCoords(next);
  }, [show, align]);

  useLayoutEffect(() => {
    if (!show) {
      setCoords(null);
      return undefined;
    }
    reposition();
    const onScroll = () => reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [show, reposition, children]);

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
      const root = rootRef.current;
      const panel = panelRef.current;
      if (root?.contains(e.target) || panel?.contains(e.target)) return;
      setPinned(false);
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pinned]);

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

  const panel = show && coords ? (
    <div
      id={tipId}
      ref={panelRef}
      role="tooltip"
      className={`info-tooltip__panel info-tooltip__panel--portaled${pinned ? ' info-tooltip__panel--pinned' : ''}`}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        maxWidth: coords.maxWidth,
        zIndex: 10950,
      }}
    >
      {children}
      {pinned && <div className="info-tooltip__pin-hint">Pinned — Esc to close</div>}
    </div>
  ) : null;

  return (
    <span
      ref={rootRef}
      className={`info-tooltip ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { if (!pinned) setOpen(false); }}
    >
      <span
        ref={triggerRef}
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
      {panel && typeof document !== 'undefined' ? createPortal(panel, document.body) : null}
    </span>
  );
}