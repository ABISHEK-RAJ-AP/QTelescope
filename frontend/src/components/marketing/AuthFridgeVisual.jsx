import React, { useEffect, useState } from 'react';
import { AuthFridgeSvgLoop } from './AuthFridgeSvgLoop.jsx';
import './auth-fridge.css';

/**
 * Auth cryostat — crisp colorful SVG (no framed blue tile).
 * WebGL path dropped here: quality/clipping was unreliable in the auth card.
 */
export function AuthFridgeVisual() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(motion.matches);
    sync();
    motion.addEventListener('change', sync);
    return () => motion.removeEventListener('change', sync);
  }, []);

  return (
    <div className="auth-fridge" role="img" aria-label="Dilution refrigerator animation">
      <AuthFridgeSvgLoop reduced={reduced} />
    </div>
  );
}
