import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

function placePanel(triggerEl, panelEl, align = 'end') {
  if (!triggerEl) return { top: 0, left: 0, maxWidth: 320 };
  const tr = triggerEl.getBoundingClientRect();
  const margin = 8;
  const gap = 6;
  const maxW = Math.min(320, window.innerWidth - margin * 2);
  const pw = Math.min(panelEl?.offsetWidth || maxW, maxW) || maxW;
  const ph = panelEl?.offsetHeight || 120;

  let top = tr.bottom + gap;
  if (top + ph > window.innerHeight - margin && tr.top - gap - ph > margin) {
    top = tr.top - gap - ph;
  }

  let left;
  if (align === 'start') {
    left = tr.left;
  } else if (align === 'center') {
    left = tr.left + (tr.width - pw) / 2;
  } else {
    left = tr.right - pw;
  }
  left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));

  return { top, left, maxWidth: maxW, width: pw };
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
    setCoords(placePanel(triggerRef.current, panelRef.current, align));
  }, [show, align]);

  useLayoutEffect(() => {
    if (!show) {
      setCoords(null);
      return undefined;
    }
    reposition();
    const raf = requestAnimationFrame(() => reposition());
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
      cancelAnimationFrame(raf);
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

  const triggerTop = triggerRef.current?.getBoundingClientRect().top ?? 0;
  const opensAbove = coords && coords.top < triggerTop;

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
        width: coords.width,
        maxWidth: coords.maxWidth,
        zIndex: 10950,
        '--qt-tooltip-origin': opensAbove ? 'bottom center' : 'top center',
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