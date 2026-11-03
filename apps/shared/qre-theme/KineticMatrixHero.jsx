import { useCallback, useEffect, useRef, useState } from 'react';
import { readTheme, resolveDataTheme } from './theme.js';

function resolvedIsDark() {
  const data = resolveDataTheme(readTheme());
  return data !== 'light';
}

/**
 * Cert Studio–style lattice hero (canvas). Theme follows qre_studio_theme / data-theme.
 */
export default function KineticMatrixHero({ title = 'QRP', className = '', showHud = false }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [isRunning, setIsRunning] = useState(true);
  const [isDark, setIsDark] = useState(resolvedIsDark);

  const pointerRef = useRef({
    x: -2000,
    y: -2000,
    prevX: -2000,
    prevY: -2000,
    vx: 0,
    vy: 0,
    radius: 220,
    isDown: false,
  });
  const nodesRef = useRef([]);
  const pulsesRef = useRef([]);
  const shockwavesRef = useRef([]);
  const dimensionsRef = useRef({ width: 0, height: 0, cols: 0, rows: 0, spacing: 52 });

  useEffect(() => {
    const sync = () => setIsDark(resolvedIsDark());
    sync();
    window.addEventListener('qre-theme-changed', sync);
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      window.removeEventListener('qre-theme-changed', sync);
      obs.disconnect();
    };
  }, []);

  const buildLattice = useCallback((width, height) => {
    const spacing = 52;
    const cols = Math.ceil(width / spacing) + 1;
    const rows = Math.ceil(height / spacing) + 1;
    const nodes = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = c * spacing;
        const y = r * spacing;
        nodes.push({
          x,
          y,
          vx: 0,
          vy: 0,
          baseX: x,
          baseY: y,
          col: c,
          row: r,
          radius: 1.4,
          label: `0x${((c * 17 + r * 31) % 256).toString(16).padStart(2, '0').toUpperCase()}`,
          tension: 0,
          pulsePhase: Math.random() * Math.PI * 2,
        });
      }
    }
    dimensionsRef.current = { width, height, cols, rows, spacing };
    nodesRef.current = nodes;
    pulsesRef.current = [];
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return undefined;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.contentRect;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        buildLattice(rect.width, rect.height);
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [buildLattice]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return undefined;

    let animId = 0;
    let lastTime = performance.now();

    const render = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;
      if (!isRunning) {
        animId = requestAnimationFrame(render);
        return;
      }

      const { width, height, cols, rows, spacing } = dimensionsRef.current;
      const nodes = nodesRef.current;
      const pulses = pulsesRef.current;
      const shockwaves = shockwavesRef.current;
      const pointer = pointerRef.current;

      pointer.vx = (pointer.x - pointer.prevX) / (dt * 1000 || 1);
      pointer.vy = (pointer.y - pointer.prevY) / (dt * 1000 || 1);
      pointer.prevX = pointer.x;
      pointer.prevY = pointer.y;
      const mouseSpeed = Math.sqrt(pointer.vx * pointer.vx + pointer.vy * pointer.vy);

      const bgColor = isDark ? '#06070a' : '#f8fafc';
      const nodeRgb = isDark ? '226, 232, 240' : '15, 23, 42';
      const accentRgb = isDark ? '34, 211, 238' : '8, 145, 178';
      const ink = isDark ? '#e2e8f0' : '#0f172a';
      const pulseInk = isDark ? '#22d3ee' : '#0891b2';

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      for (let s = shockwaves.length - 1; s >= 0; s--) {
        const sw = shockwaves[s];
        sw.radius += 400 * dt;
        sw.power *= 0.12 ** dt;
        if (sw.radius > sw.maxRadius || sw.power < 0.01) shockwaves.splice(s, 1);
      }

      const SPRING_K = 26;
      const DAMPING = 0.85;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.pulsePhase += dt * 3.2;
        const dx = pointer.x - n.x;
        const dy = pointer.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < pointer.radius && dist > 0) {
          const ratio = 1 - dist / pointer.radius;
          const force = ratio * (1600 + mouseSpeed * 180 + (pointer.isDown ? 2400 : 0));
          const angle = Math.atan2(dy, dx);
          n.vx -= Math.cos(angle) * force * dt;
          n.vy -= Math.sin(angle) * force * dt;
          n.tension = Math.min(1, n.tension + ratio * 0.5);
        }
        for (let s = 0; s < shockwaves.length; s++) {
          const sw = shockwaves[s];
          const swDx = n.x - sw.x;
          const swDy = n.y - sw.y;
          const swDist = Math.sqrt(swDx * swDx + swDy * swDy);
          const delta = Math.abs(swDist - sw.radius);
          if (delta < 55) {
            const force = (1 - delta / 55) * sw.power * 2800;
            const angle = Math.atan2(swDy, swDx);
            n.vx += Math.cos(angle) * force * dt;
            n.vy += Math.sin(angle) * force * dt;
            n.tension = 1;
          }
        }
        n.vx += (n.baseX - n.x) * SPRING_K * dt;
        n.vy += (n.baseY - n.y) * SPRING_K * dt;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx * dt * 60;
        n.y += n.vy * dt * 60;
        n.tension = Math.max(0, n.tension - dt * 0.9);
      }

      if (Math.random() < 0.3 && nodes.length > 0 && pulses.length < 40) {
        const fromIdx = Math.floor(Math.random() * nodes.length);
        const fromNode = nodes[fromIdx];
        const dirs = [
          { dc: 1, dr: 0 },
          { dc: -1, dr: 0 },
          { dc: 0, dr: 1 },
          { dc: 0, dr: -1 },
        ];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        const targetCol = fromNode.col + dir.dc;
        const targetRow = fromNode.row + dir.dr;
        if (targetCol >= 0 && targetCol < cols && targetRow >= 0 && targetRow < rows) {
          const toIdx = targetCol * rows + targetRow;
          if (toIdx >= 0 && toIdx < nodes.length) {
            pulses.push({ fromNode: fromIdx, toNode: toIdx, progress: 0, speed: 1.6 + Math.random() * 2.2 });
          }
        }
      }

      const drawLink = (n1, n2) => {
        const dx = n1.x - n2.x;
        const dy = n1.y - n2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const stretch = Math.abs(dist - spacing) / spacing;
        const isTensioned = n1.tension > 0.05 || n2.tension > 0.05 || stretch > 0.1;
        if (isTensioned) {
          const glow = Math.max(n1.tension, n2.tension, stretch * 2);
          ctx.strokeStyle = `rgba(${accentRgb}, ${Math.min(1, 0.3 + glow * 0.7)})`;
          ctx.lineWidth = 0.8 + glow * 1.4;
        } else {
          ctx.strokeStyle = `rgba(${nodeRgb}, ${isDark ? 0.12 : 0.08})`;
          ctx.lineWidth = 0.65;
        }
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
      };

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const idx = c * rows + r;
          const n = nodes[idx];
          if (!n) continue;
          if (c < cols - 1) {
            const nr = nodes[(c + 1) * rows + r];
            if (nr) drawLink(n, nr);
          }
          if (r < rows - 1) {
            const nd = nodes[c * rows + r + 1];
            if (nd) drawLink(n, nd);
          }
        }
      }

      for (let p = pulses.length - 1; p >= 0; p--) {
        const pulse = pulses[p];
        pulse.progress += dt * pulse.speed;
        const n1 = nodes[pulse.fromNode];
        const n2 = nodes[pulse.toNode];
        if (!n1 || !n2 || pulse.progress >= 1) {
          if (n2) n2.tension = Math.min(1, n2.tension + 0.35);
          pulses.splice(p, 1);
          continue;
        }
        const px = n1.x + (n2.x - n1.x) * pulse.progress;
        const py = n1.y + (n2.y - n1.y) * pulse.progress;
        ctx.fillStyle = pulseInk;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const dx = pointer.x - n.x;
        const dy = pointer.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const isNear = dist < pointer.radius;
        const currentRadius = isNear ? n.radius * 2.2 + n.tension * 1.5 : n.radius + Math.sin(n.pulsePhase) * 0.25;
        if (isNear || n.tension > 0.1) {
          ctx.fillStyle = `rgba(${accentRgb}, ${Math.min(1, 0.2 + n.tension * 0.55)})`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, currentRadius * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = isNear || n.tension > 0.1 ? ink : `rgba(${nodeRgb}, ${isDark ? 0.35 : 0.25})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, Math.max(0.8, currentRadius), 0, Math.PI * 2);
        ctx.fill();
        if (dist < 90) {
          const radarRing = ((n.pulsePhase * 20) % 32) + 4;
          ctx.strokeStyle = `rgba(${accentRgb}, ${(1 - radarRing / 36) * 0.45})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(n.x, n.y, radarRing, 0, Math.PI * 2);
          ctx.stroke();
          ctx.font = '8px var(--font-mono, ui-monospace, monospace)';
          ctx.fillStyle = `rgba(${accentRgb}, 0.9)`;
          ctx.fillText(n.label, n.x + 9, n.y - 9);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, isDark]);

  const triggerCentralImpulse = () => {
    const { width, height } = dimensionsRef.current;
    shockwavesRef.current.push({
      x: width / 2,
      y: height / 2,
      radius: 10,
      maxRadius: Math.max(width, height) * 0.85,
      power: 1.4,
    });
  };

  return (
    <div
      ref={containerRef}
      className={`qre-kinetic-hero ${className}`.trim()}
      onMouseMove={(e) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        pointerRef.current.x = e.clientX - rect.left;
        pointerRef.current.y = e.clientY - rect.top;
      }}
      onMouseDown={(e) => {
        const container = containerRef.current;
        if (!container) return;
        pointerRef.current.isDown = true;
        const rect = container.getBoundingClientRect();
        shockwavesRef.current.push({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          radius: 8,
          maxRadius: 420,
          power: 1.2,
        });
      }}
      onMouseUp={() => {
        pointerRef.current.isDown = false;
      }}
      onMouseLeave={() => {
        pointerRef.current.x = -2000;
        pointerRef.current.y = -2000;
        pointerRef.current.isDown = false;
      }}
    >
      <canvas ref={canvasRef} className="qre-kinetic-hero__canvas" aria-hidden />
      <div className="qre-kinetic-hero__overlay">
        {showHud && (
          <div className="qre-kinetic-hero__hud">
            <button type="button" className="qre-kinetic-hero__hud-btn" onClick={triggerCentralImpulse}>
              Pulse
            </button>
            <button type="button" className="qre-kinetic-hero__hud-btn" onClick={() => setIsRunning((v) => !v)}>
              {isRunning ? 'Freeze' : 'Run'}
            </button>
          </div>
        )}
        <p className="qre-kinetic-hero__title">{title}</p>
        <p className="qre-kinetic-hero__hint">Interactive lattice · hover for node IDs</p>
      </div>
    </div>
  );
}
