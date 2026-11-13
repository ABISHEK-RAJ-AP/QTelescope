import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTheme } from '../ui/ThemeProvider.jsx';
import {
  FRIDGE_SCROLL_LENGTH_VH,
  FRIDGE_STAGES,
  activeStageIndex,
  clamp01,
  progressForStage,
  stageY,
} from './quantum-fridge-model.js';
import { QuantumFridgeSvg } from './QuantumFridgeSvg.jsx';
import './quantum-fridge.css';

const QuantumFridge3D = lazy(() => import('./QuantumFridge3D.jsx'));

function webGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function QuantumFridge() {
  const { resolved } = useTheme();
  const sectionRef = useRef(null);
  const progressRef = useRef(0);
  const hoveredIndex = useRef(null);
  const stageRefs = useRef([]);
  const cableRefs = useRef([]);
  const rodRefs = useRef([]);
  const shieldRef = useRef(null);
  const qpuRef = useRef(null);
  const cableEndRefs = useRef([]);
  const scrollFillRef = useRef(null);
  const dotRefs = useRef([]);
  const runtime = useRef({
    target: 0,
    current: 0,
    frame: 0,
    visible: true,
    reduced: false,
    last: 0,
  });

  const [use3d, setUse3d] = useState(() => webGLAvailable());
  const [canvasActive, setCanvasActive] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  const renderSvgProgress = (progress) => {
    const ys = FRIDGE_STAGES.map((_, index) => stageY(progress, index));
    stageRefs.current.forEach((node, index) => {
      if (!node) return;
      const dy = ys[index] - FRIDGE_STAGES[index].assembledY;
      node.setAttribute('transform', `translate(0 ${dy.toFixed(2)})`);
    });
    cableRefs.current.forEach((node, index) => {
      if (!node) return;
      const points = ys.map((y, si) => {
        const lane = index % 12;
        const spread = (lane - 5.5) * 8.3;
        return `${250 + spread},${y + 5}`;
      });
      node.setAttribute('d', `M ${points.join(' L ')}`);
    });
    rodRefs.current.forEach((node) => {
      if (node) node.setAttribute('y2', (ys.at(-1) + 14).toFixed(1));
    });
    const mixingDelta = ys.at(-1) - FRIDGE_STAGES.at(-1).assembledY;
    shieldRef.current?.setAttribute('transform', `translate(0 ${mixingDelta.toFixed(2)})`);
    if (qpuRef.current) {
      const glow = clamp01((progress - 0.82) / 0.14);
      qpuRef.current.style.opacity = String(0.35 + glow * 0.65);
    }
  };

  const renderProgress = (progress) => {
    progressRef.current = progress;
    if (scrollFillRef.current) {
      scrollFillRef.current.style.transform = `scaleY(${Math.max(0.02, progress)})`;
    }
    const active = activeStageIndex(progress);
    dotRefs.current.forEach((node, index) => {
      if (node) node.dataset.active = index === active ? 'true' : 'false';
    });
    if (!use3d) renderSvgProgress(progress);
  };

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;

    const state = runtime.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateReduced = () => {
      state.reduced = motion.matches;
      setReducedMotion(motion.matches);
      if (state.reduced) {
        state.target = 1;
        state.current = 1;
        renderProgress(1);
      } else {
        measure();
      }
    };

    const measure = () => {
      if (state.reduced) return;
      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      state.target = clamp01(-rect.top / travel);
      if (!state.frame && state.visible) state.frame = requestAnimationFrame(tick);
    };

    const tick = (now) => {
      const dt = state.last ? Math.min((now - state.last) / 1000, 1 / 30) : 1 / 60;
      state.last = now;
      const follow = 1 - Math.exp(-dt / 0.16);
      state.current += (state.target - state.current) * follow;
      if (Math.abs(state.target - state.current) < 0.0005) state.current = state.target;
      renderProgress(state.current);
      if (state.visible && Math.abs(state.target - state.current) >= 0.0005) {
        state.frame = requestAnimationFrame(tick);
      } else {
        state.frame = 0;
        state.last = 0;
      }
    };

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      state.visible = entry.isIntersecting;
      setCanvasActive(entry.isIntersecting);
      if (state.visible) {
        measure();
        if (!state.frame && !state.reduced) state.frame = requestAnimationFrame(tick);
      } else if (state.frame) {
        cancelAnimationFrame(state.frame);
        state.frame = 0;
        state.last = 0;
      }
    }, { rootMargin: '160px 0px' });

    updateReduced();
    measure();
    renderProgress(state.reduced ? 1 : state.target);
    observer.observe(section);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    motion.addEventListener('change', updateReduced);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      motion.removeEventListener('change', updateReduced);
      if (state.frame) cancelAnimationFrame(state.frame);
    };
  }, [use3d]);

  const scrollToStage = (index) => {
    const section = sectionRef.current;
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const travel = Math.max(1, section.offsetHeight - window.innerHeight);
    window.scrollTo({ top: top + travel * progressForStage(index), behavior: 'smooth' });
  };

  return (
    <section
      ref={sectionRef}
      className="qf-hero"
      style={{ '--qf-scroll-vh': `${FRIDGE_SCROLL_LENGTH_VH}vh` }}
      data-theme={resolved === 'dark' ? 'dark' : 'light'}
      aria-label="Interactive dilution refrigerator"
    >
      <div className="qf-hero__sticky">
        <div className="qf-hero__stage">
          {use3d ? (
            <Suspense fallback={<div className="qf-hero__loading">Loading…</div>}>
              <QuantumFridge3D
                progress={progressRef}
                hoveredIndex={hoveredIndex}
                reduced={reducedMotion}
                active={canvasActive}
                onPerfDecline={() => setUse3d(false)}
              />
            </Suspense>
          ) : (
            <QuantumFridgeSvg
              stageRefs={stageRefs}
              cableRefs={cableRefs}
              rodRefs={rodRefs}
              shieldRef={shieldRef}
              qpuRef={qpuRef}
              cableEndRefs={cableEndRefs}
            />
          )}
        </div>

        <div className="qf-hero__overlay">
          <p className="qf-hero__kicker">Q-TeleScope</p>
          <h1 className="qf-hero__title">Observability for superconducting QPUs</h1>
          <p className="qf-hero__lead">
            Scroll to assemble the cryostat — then open the console.
          </p>
          <div className="qf-hero__actions">
            <Link className="qf-hero__cta" to="/login">
              Sign in <ArrowRight size={18} strokeWidth={2.5} aria-hidden />
            </Link>
            <Link className="qf-hero__cta qf-hero__cta--ghost" to="/register">
              Sign up
            </Link>
          </div>
        </div>

        <nav className="qf-hero__rail" aria-label="Scroll progress">
          <span className="qf-hero__rail-track">
            <span ref={scrollFillRef} className="qf-hero__rail-fill" />
          </span>
          {FRIDGE_STAGES.map((stage, index) => (
            <button
              key={stage.id}
              type="button"
              className="qf-hero__dot"
              ref={(node) => { dotRefs.current[index] = node; }}
              data-active={index === 0 ? 'true' : 'false'}
              aria-label={stage.name}
              onClick={() => scrollToStage(index)}
            />
          ))}
        </nav>

        <span className="qf-hero__scroll-hint" aria-hidden="true">
          Scroll
        </span>
      </div>
    </section>
  );
}
