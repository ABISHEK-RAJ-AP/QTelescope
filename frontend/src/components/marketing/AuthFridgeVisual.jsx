import React, { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { canCreateWebGLContext } from './webgl-capable.js';
import { AuthFridgeSvgLoop } from './AuthFridgeSvgLoop.jsx';
import { loopProgress } from './auth-fridge-svg.js';
import './auth-fridge.css';

const QuantumFridge3D = lazy(() => import('./QuantumFridge3D.jsx'));

class FridgeCanvasBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFail?.();
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function AuthFridgeCanvas({ onWebGLFail }) {
  const progressRef = useRef(0.88);
  const hoveredIndex = useRef(null);
  const frame = useRef(0);
  const [active, setActive] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setReduced(motion.matches);
      if (motion.matches) progressRef.current = 0.88;
    };
    sync();
    motion.addEventListener('change', sync);
    return () => motion.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (reduced) return undefined;
    const start = performance.now();
    const tick = (now) => {
      progressRef.current = loopProgress((now - start) / 1000);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [reduced]);

  return (
    <QuantumFridge3D
      progress={progressRef}
      hoveredIndex={hoveredIndex}
      reduced={reduced}
      active={active}
      onPerfDecline={() => {
        setActive(false);
        onWebGLFail?.();
      }}
      variant="auth"
    />
  );
}

export function AuthFridgeVisual() {
  const [mode, setMode] = useState(() => (canCreateWebGLContext() ? '3d' : 'svg'));
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(motion.matches);
    sync();
    motion.addEventListener('change', sync);
    return () => motion.removeEventListener('change', sync);
  }, []);

  const svgFallback = <AuthFridgeSvgLoop reduced={reduced} />;

  if (mode === 'svg') {
    return <div className="auth-fridge">{svgFallback}</div>;
  }

  return (
    <div className="auth-fridge" role="img" aria-label="Dilution refrigerator animation">
      <FridgeCanvasBoundary fallback={svgFallback} onFail={() => setMode('svg')}>
        <Suspense fallback={<div className="auth-fridge__loading" aria-hidden />}>
          <AuthFridgeCanvas onWebGLFail={() => setMode('svg')} />
        </Suspense>
      </FridgeCanvasBoundary>
    </div>
  );
}
