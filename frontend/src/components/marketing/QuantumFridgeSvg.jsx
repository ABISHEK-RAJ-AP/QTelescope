/** Lightweight SVG fallback when WebGL is unavailable or FPS drops. */
import React, { useMemo } from 'react';
import { FRIDGE_STAGES } from './quantum-fridge-model.js';

const SVG_CX = 250;
const ELLIPSE_RATIO = 0.27;

function cableX(cableIndex, stageIndex) {
  const lane = cableIndex % 12;
  const bank = Math.floor(cableIndex / 12);
  const spread = (lane - 5.5) * 8.3;
  const bow = Math.sin((stageIndex + bank * 0.7) * 1.35) * (5 + bank * 2);
  return SVG_CX + spread + bow;
}

function cablePath(cableIndex, ys) {
  const points = ys.map((y, stageIndex) => [cableX(cableIndex, stageIndex), y + 5]);
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i += 1) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const mid = (py + y) / 2;
    d += ` C ${px.toFixed(1)} ${mid.toFixed(1)}, ${x.toFixed(1)} ${mid.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

export function QuantumFridgeSvg({ stageRefs, cableRefs, rodRefs, shieldRef, qpuRef, cableEndRefs }) {
  const cableIndices = useMemo(() => Array.from({ length: 32 }, (_, i) => i), []);
  const restYs = FRIDGE_STAGES.map((s) => s.assembledY);

  return (
    <svg viewBox="0 0 500 610" role="img" aria-hidden="true" className="quantum-fridge-figure__svg">
      <g className="qf-rods">
        {[154, 190, 226, 274, 310, 346].map((x, index) => (
          <line key={x} ref={(n) => { rodRefs.current[index] = n; }} x1={x} y1={68} x2={x} y2={262} />
        ))}
      </g>
      <g className="qf-cables">
        {cableIndices.map((index) => (
          <path
            key={index}
            ref={(n) => { cableRefs.current[index] = n; }}
            className="qf-cable"
            d={cablePath(index, restYs)}
          />
        ))}
      </g>
      {FRIDGE_STAGES.map((stage, index) => (
        <g
          key={stage.id}
          ref={(n) => { stageRefs.current[index] = n; }}
          className="qf-stage"
        >
          <ellipse cx={SVG_CX} cy={stage.assembledY} rx={stage.radius} ry={stage.radius * ELLIPSE_RATIO} className="qf-stage__top" style={{ '--stage-color': stage.color }} />
        </g>
      ))}
      <g ref={shieldRef} className="qf-shield">
        <ellipse cx={SVG_CX} cy={338} rx={56} ry={15} />
        <g ref={qpuRef} className="qf-qpu">
          <path d="M226 300 L250 287 L274 300 L250 313 Z" />
        </g>
      </g>
    </svg>
  );
}
