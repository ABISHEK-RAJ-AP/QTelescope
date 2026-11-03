import React, { useEffect, useMemo, useRef } from 'react';
import { FRIDGE_STAGES } from './quantum-fridge-model.js';
import {
  SVG_CX,
  ELLIPSE_RATIO,
  applySvgProgress,
  loopProgress,
} from './auth-fridge-svg.js';

function StagePlateSvg({ stage, index, groupRef }) {
  const r = stage.radius;
  const ry = r * ELLIPSE_RATIO;
  const y = stage.assembledY;
  const h = index === 0 ? 14 : 9;
  const grad = index === 0 ? 'url(#af-copper)' : 'url(#af-gold)';
  const side = index === 0 ? '#6b3428' : '#7a5a22';

  return (
    <g ref={groupRef} className="af-plate">
      <path
        d={`M ${SVG_CX - r} ${y}
            L ${SVG_CX - r * 0.98} ${y + h}
            A ${r * 0.98} ${ry * 0.95} 0 0 0 ${SVG_CX + r * 0.98} ${y + h}
            L ${SVG_CX + r} ${y}
            A ${r} ${ry} 0 0 1 ${SVG_CX - r} ${y} Z`}
        fill={side}
        opacity={0.85}
      />
      <ellipse cx={SVG_CX} cy={y} rx={r} ry={ry} fill={grad} stroke="#3d2510" strokeWidth="0.65" />
      <ellipse cx={SVG_CX} cy={y - 1.2} rx={r * 0.88} ry={ry * 0.82} fill="url(#af-glass-shine)" opacity={0.55} />
      <ellipse cx={SVG_CX} cy={y} rx={r * 0.76} ry={ry * 0.7} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const bx = SVG_CX + Math.cos(a) * r * 0.84;
        const by = y + Math.sin(a) * ry * 0.72;
        return <circle key={i} cx={bx} cy={by} r={1.6} fill="#f2ddb0" stroke="#6e4a1c" strokeWidth="0.35" />;
      })}
    </g>
  );
}

export function AuthFridgeSvgLoop({ reduced }) {
  const stageRefs = useRef([]);
  const cableRefs = useRef([]);
  const rodRefs = useRef([]);
  const shieldRef = useRef(null);
  const qpuRef = useRef(null);
  const qpuGlowRef = useRef(null);
  const glassRef = useRef(null);
  const cables = useMemo(() => Array.from({ length: 44 }, (_, i) => i), []);

  useEffect(() => {
    const refs = { stageRefs, cableRefs, rodRefs, shieldRef, qpuRef, qpuGlowRef, glassRef };
    if (reduced) {
      applySvgProgress(0.88, refs);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      applySvgProgress(loopProgress((now - start) / 1000), refs);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const restYs = FRIDGE_STAGES.map((s) => s.assembledY);

  return (
    <svg viewBox="0 0 500 620" className="auth-fridge__svg" aria-hidden="true">
      <defs>
        <linearGradient id="af-copper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9a4a38" />
          <stop offset="35%" stopColor="#e8a07a" />
          <stop offset="70%" stopColor="#c56a4a" />
          <stop offset="100%" stopColor="#f4c9a8" />
        </linearGradient>
        <linearGradient id="af-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8a6326" />
          <stop offset="40%" stopColor="#ecc56a" />
          <stop offset="75%" stopColor="#b88932" />
          <stop offset="100%" stopColor="#f7e4a8" />
        </linearGradient>
        <radialGradient id="af-glass-shine" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#a5f3fc" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="af-rod" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#d8e0e6" />
          <stop offset="100%" stopColor="#7a848c" />
        </linearGradient>
        <filter id="af-soft-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g ref={glassRef} opacity={0.35}>
        <path
          d="M 175 55 Q 250 20 325 55 L 290 340 Q 250 365 210 340 Z"
          fill="url(#af-glass-shine)"
          stroke="rgba(165,243,252,0.25)"
          strokeWidth="0.8"
        />
      </g>

      <g className="af-rods">
        {[154, 190, 226, 274, 310, 346].map((x, index) => (
          <line
            key={x}
            ref={(n) => { rodRefs.current[index] = n; }}
            x1={x}
            y1={62}
            x2={x}
            y2={262}
            stroke="url(#af-rod)"
            strokeWidth="1.35"
          />
        ))}
      </g>

      <g className="af-cables">
        {cables.map((index) => (
          <path
            key={index}
            ref={(n) => { cableRefs.current[index] = n; }}
            fill="none"
            stroke={index % 5 === 0 ? '#d4af5a' : '#c5ced6'}
            strokeWidth={index % 3 === 0 ? 0.75 : 0.55}
            strokeLinecap="round"
            opacity={0.78}
            d={`M ${SVG_CX} ${restYs[0]} L ${SVG_CX} ${restYs.at(-1)}`}
          />
        ))}
      </g>

      {FRIDGE_STAGES.map((stage, index) => (
        <StagePlateSvg
          key={stage.id}
          stage={stage}
          index={index}
          groupRef={(n) => { stageRefs.current[index] = n; }}
        />
      ))}

      <g ref={shieldRef}>
        <ellipse cx={SVG_CX} cy={332} rx={58} ry={14} fill="#9aa3ab" stroke="#5c656d" strokeWidth="0.7" />
        <rect x={SVG_CX - 42} y={278} width={84} height={52} rx={8} fill="rgba(120,130,140,0.35)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
        <ellipse ref={qpuGlowRef} cx={SVG_CX} cy={304} rx={28} ry={10} fill="#22d3ee" opacity={0.2} filter="url(#af-soft-glow)" />
        <g ref={qpuRef}>
          <path d="M224 298 L250 284 L276 298 L250 312 Z" fill="#0c1a22" stroke="#22d3ee" strokeWidth="1" />
          <circle cx={250} cy={300} r={3.2} fill="#22d3ee" />
        </g>
      </g>
    </svg>
  );
}
