import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CONSOLE_TOUR_STEPS } from '@/lib/platformCapabilityMap';
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
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

export function ProductTour({ open, steps = CONSOLE_TOUR_STEPS, onClose, initialStep = 0 }) {
  const [index, setIndex] = useState(initialStep);
  const [spot, setSpot] = useState(null);
  const [popover, setPopover] = useState({ top: 80, left: 24 });
  const scrolledStepRef = useRef('');
  const rafRef = useRef(0);

  const step = steps[index];

  const reposition = useCallback((opts = {}) => {
    const { scroll = false } = opts;
    if (!open || !step) return;
    const el = findTourTarget(step.target);
    if (!el || !el.isConnected) {
      setSpot(null);
      setPopover({ top: 80, left: 24 });
      return;
    }
    const stepKey = `${index}:${step.target}`;
    if (scroll && scrolledStepRef.current !== stepKey) {
      scrolledStepRef.current = stepKey;
      try {
        el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      } catch {
        /* ignore */
      }
    }
    const box = measureTarget(el);
    setSpot(box);
    const popTop = box.top + box.height + 12;
    const popLeft = Math.min(Math.max(16, box.left), window.innerWidth - 336);
    if (popTop + 180 > window.innerHeight) {
      setPopover({ top: Math.max(16, box.top - 168), left: popLeft });
    } else {
      setPopover({ top: popTop, left: popLeft });
    }
  }, [open, step, index]);

  useEffect(() => {
    if (!open) return undefined;
    setIndex(initialStep);
    scrolledStepRef.current = '';
    return undefined;
  }, [open, initialStep]);

  useLayoutEffect(() => {
    if (!open || !step) return undefined;
    reposition({ scroll: true });
    let tries = 0;
    const retry = window.setInterval(() => {
      tries += 1;
      const el = findTourTarget(step.target);
      if (el?.isConnected || tries > 8) {
        window.clearInterval(retry);
        if (el?.isConnected) reposition({ scroll: false });
      }
    }, 150);
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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !step) return null;

  const atEnd = index >= steps.length - 1;
  const missingTarget = !findTourTarget(step.target)?.isConnected;

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
        {missingTarget ? (
          <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--text-muted)' }}>
            This control is not visible on the current layout — use Next to continue.
          </p>
        ) : null}
        <div className="product-tour-popover__foot">
          <span className="product-tour-popover__progress">
            {index + 1} / {steps.length}
          </span>
          <div className="product-tour-popover__actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onClose?.()}>
              Skip
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={goNext}>
              {atEnd ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
