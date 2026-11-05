import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CONSOLE_TOUR_STEPS } from '@/lib/consoleTour';
import './onboarding.css';

function findTourTarget(targetId) {
  return document.querySelector(`[data-tour="${targetId}"]`);
}

function measureTarget(el) {
  const rect = el.getBoundingClientRect();
  const pad = 8;
  return {
    top: Math.max(8, rect.top - pad),
    left: Math.max(8, rect.left - pad),
    width: Math.min(rect.width + pad * 2, window.innerWidth - 16),
    height: Math.min(rect.height + pad * 2, Math.round(window.innerHeight * 0.58), window.innerHeight - 16),
  };
}

function placePopover(box) {
  const w = Math.min(340, window.innerWidth - 24);
  const h = 220;
  const sidebarHit = box.left < 280 && box.width < 320;
  if (sidebarHit) {
    return {
      top: Math.min(box.top, window.innerHeight - h - 16),
      left: Math.min(box.left + box.width + 12, window.innerWidth - w - 12),
    };
  }
  let top = box.top + box.height + 12;
  let left = Math.min(Math.max(16, box.left), window.innerWidth - w - 12);
  if (top + h > window.innerHeight) {
    top = Math.max(16, box.top - h - 12);
  }
  return { top, left };
}

export function ProductTour({
  open,
  steps = CONSOLE_TOUR_STEPS,
  onClose,
  onStep,
  initialStep = 0,
}) {
  const [index, setIndex] = useState(initialStep);
  const [spot, setSpot] = useState(null);
  const [popover, setPopover] = useState({ top: 80, left: 24 });
  const scrolledStepRef = useRef('');
  const rafRef = useRef(0);
  const notifiedRef = useRef('');

  const step = steps[index];

  const reposition = useCallback((opts = {}) => {
    const { scroll = false } = opts;
    if (!open || !step) return;
    const el = findTourTarget(step.target);
    if (!el || !el.isConnected) {
      setSpot(null);
      setPopover({ top: 88, left: 288 });
      return;
    }
    const stepKey = `${index}:${step.target}`;
    if (scroll && scrolledStepRef.current !== stepKey) {
      scrolledStepRef.current = stepKey;
      try {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      } catch {
        /* ignore */
      }
    }
    const box = measureTarget(el);
    setSpot(box);
    setPopover(placePopover(box));
  }, [open, step, index]);

  useEffect(() => {
    if (!open) return undefined;
    setIndex(initialStep);
    scrolledStepRef.current = '';
    notifiedRef.current = '';
    setSpot(null);
    return undefined;
  }, [open, initialStep]);

  useEffect(() => {
    setSpot(null);
    scrolledStepRef.current = '';
  }, [index]);

  useEffect(() => {
    if (!open || !step) return undefined;
    const key = `${index}:${step.target}`;
    if (notifiedRef.current === key) return undefined;
    notifiedRef.current = key;
    onStep?.(step);
    return undefined;
  }, [open, step, index, onStep]);

  useLayoutEffect(() => {
    if (!open || !step) return undefined;
    reposition({ scroll: true });
    let tries = 0;
    const retry = window.setInterval(() => {
      tries += 1;
      const el = findTourTarget(step.target);
      if (el?.isConnected || tries > 20) {
        window.clearInterval(retry);
        if (el?.isConnected) reposition({ scroll: true });
      }
    }, 120);
    return () => window.clearInterval(retry);
  }, [reposition, index, open, step]);

  useEffect(() => {
    if (!open) return undefined;
    const schedule = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => reposition({ scroll: false }));
    };
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, steps.length]);

  if (!open || !step) return null;

  const atEnd = index >= steps.length - 1;

  const goNext = () => {
    if (atEnd) {
      onClose?.();
      return;
    }
    setIndex((i) => i + 1);
  };

  return (
    <div className="product-tour-root" role="dialog" aria-modal="true" aria-label="Product tour">
      <div className="product-tour-backdrop" onClick={() => onClose?.()} aria-hidden />
      {spot && (
        <div
          className="product-tour-spotlight"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
        />
      )}
      <div
        className="product-tour-popover"
        style={{ top: popover.top, left: popover.left }}
      >
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        {step.lesson ? <p className="product-tour-popover__lesson">{step.lesson}</p> : null}
        {!spot ? (
          <p className="product-tour-popover__wait">Waiting for this region to render. Next skips it.</p>
        ) : null}
        <div className="product-tour-popover__foot">
          <span className="product-tour-popover__progress">
            {index + 1} / {steps.length}
          </span>
          <div className="product-tour-popover__actions">
            <button type="button" className="btn btn-secondary btn--xs" onClick={() => onClose?.()}>
              Skip
            </button>
            <button type="button" className="btn btn-secondary btn--xs" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
              Back
            </button>
            <button type="button" className="btn btn-primary btn--xs" onClick={goNext}>
              {atEnd ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
