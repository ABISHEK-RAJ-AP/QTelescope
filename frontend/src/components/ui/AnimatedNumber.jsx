import React, { useEffect, useRef, useState } from 'react';

function prefersReducedMotion() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

/** Tabular KPI count — short ease on change. Skips animation when reduced motion. */
export function AnimatedNumber({ value, className, duration = 380 }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const target = Number(value);
    if (!Number.isFinite(target)) {
      setDisplay(value);
      return undefined;
    }
    if (prefersReducedMotion()) {
      setDisplay(target);
      return undefined;
    }
    const start = performance.now();
    const from = Number(fromRef.current);
    const delta = target - from;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + delta * eased);
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  useEffect(() => {
    const n = Number(value);
    if (Number.isFinite(n)) fromRef.current = n;
  }, [value]);

  return (
    <span className={className ? `animated-number ${className}` : 'animated-number'} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {display}
    </span>
  );
}
