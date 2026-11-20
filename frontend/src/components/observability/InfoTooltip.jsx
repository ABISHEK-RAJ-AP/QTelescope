import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

/** Places panel below trigger; `align` controls horizontal anchor (default: start). */
function placePanel(triggerEl, panelEl, align = 'start') {
  if (!triggerEl) return { top: 0, left: 0, maxWidth: 320 };
  const tr = triggerEl.getBoundingClientRect();
  const margin = 8;
  const gap = 8;
  const maxW = Math.min(320, window.innerWidth - margin * 2);
  const measuredW = panelEl?.offsetWidth;
  const measuredH = panelEl?.offsetHeight;
  const pw = measuredW && measuredW > 0 ? Math.min(measuredW, maxW) : maxW;
  const ph = measuredH && measuredH > 0 ? measuredH : 96;

  const spaceBelow = window.innerHeight - tr.bottom - margin;
  const spaceAbove = tr.top - margin;
  let top = tr.bottom + gap;
  if (ph + gap > spaceBelow && spaceAbove > spaceBelow && spaceAbove >= ph + gap) {
    top = tr.top - gap - ph;
  }

  let left;
  if (align === 'end') {
    left = tr.right - pw;
  } else if (align === 'center') {
    left = tr.left + (tr.width - pw) / 2;
  } else {
    left = tr.left;
  }
  left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));

  return { top, left, maxWidth: maxW, opensAbove: top < tr.top };
}

/**
 * Accessible help popover (hover, focus, click-to-pin). Panel portals to body so sidebar/card overflow cannot clip it.
 */
export function InfoTooltip({ label = 'More information', children, className = '', align = 'start' }) {
  const id = useId();
  const tipId = `tip-${id.replace(/:/g, '')}`;
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [coords, setCoords] = useState(null);
  const [positioned, setPositioned] = useState(false);

  const show = open || pinned;

  const reposition = useCallback(() => {
    if (!show) return;
    const next = placePanel(triggerRef.current, panelRef.current, align);
    setCoords(next);
    setPositioned(true);
  }, [show, align]);

  useLayoutEffect(() => {
    if (!show) {
      setCoords(null);
      setPositioned(false);
      return undefined;
    }
    setPositioned(false);
    reposition();
    const raf1 = requestAnimationFrame(() => {
      reposition();
      requestAnimationFrame(reposition);
    });
    const onScroll = () => reposition();
    window.addEventListener('resize', reposition, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    let ro;
    const panel = panelRef.current;
    if (panel && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => reposition());
      ro.observe(panel);
    }
    return () => {
      cancelAnimationFrame(raf1);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', onScroll, true);
      ro?.disconnect();
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
      className={`info-tooltip__panel info-tooltip__panel--portaled${pinned ? ' info-tooltip__panel--pinned' : ''}${positioned ? ' info-tooltip__panel--ready' : ''}`}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        maxWidth: coords.maxWidth,
        zIndex: 10950,
        '--qt-tooltip-origin': coords.opensAbove ? 'bottom left' : 'top left',
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