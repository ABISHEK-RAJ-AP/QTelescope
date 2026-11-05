import React, { useEffect, useState } from 'react';
import { useTheme } from '../ui/ThemeProvider.jsx';
import './quantum-figure-anatomy.css';

/**
 * Isometric superconducting QPU stack (Anatomy-style figure).
 * Illustrative motion only, not live fleet telemetry.
 */
export function QuantumComputerFigure({ className = '' }) {
  const { resolved } = useTheme();
  const theme = resolved === 'dark' ? 'dark' : 'light';
  const [readout, setReadout] = useState({ t1: 42.6, phase: 0 });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = (now - start) / 1000;
      setReadout({
        t1: 38 + Math.sin(t * 0.7) * 4.2 + Math.sin(t * 2.1) * 0.8,
        phase: Math.floor(t * 2) % 4,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const activeQubit = readout.phase;

  return (
    <figure
      className={`iso-qc ${className}`.trim()}
      data-theme={theme}
      aria-label="Illustration: cryogenic QPU with microwave bus and qubit readout"
    >
      <div className="iso-plate">
        <div className="iso-plate-corners">
          <span className="iso-plate-corner" data-corner="fig">Fig 1</span>
          <span className="iso-plate-corner" data-corner="title">Transmon stack</span>
          <span className="iso-plate-corner" data-corner="hint">Drag collectors · stored telemetry</span>
          <span className="iso-plate-corner" data-corner="readout">
            T1 {readout.t1.toFixed(1)} µs · Q{activeQubit}
          </span>
        </div>

        <svg className="iso-svg" viewBox="0 0 420 280" role="img" aria-hidden="true">
          {/* Base bench */}
          <g className="iso-solid">
            <path className="iso-shade" data-shade="1" d="M40 200 L200 120 L380 200 L220 280 Z" />
            <path className="iso-top" d="M40 200 L200 120 L380 200 L220 280 Z" />
            <path className="iso-line" data-tone="hi" d="M40 200 L200 120 L380 200 L220 280 Z" />
          </g>

          {/* Cryostat body */}
          <g className="iso-solid">
            <path className="iso-fill" d="M130 155 L210 95 L290 155 L290 195 L210 255 L130 195 Z" />
            <path className="iso-shade" data-shade="0" d="M130 195 L210 255 L290 195 L290 155 L210 215 Z" />
            <path className="iso-shade" data-shade="2" d="M130 155 L130 195 L210 255 L210 215 L210 95 Z" />
            <path className="iso-top" d="M130 155 L210 95 L290 155 L210 215 Z" />
            <path className="iso-line" data-tone="hi" d="M130 155 L210 95 L290 155 L290 195 L210 255 L130 195 Z" />
            <path className="iso-line" data-tone="faint" d="M210 95 L210 255" />
          </g>

          {/* Top flange */}
          <g className="iso-solid">
            <path className="iso-top" d="M150 145 L210 105 L270 145 L210 185 Z" />
            <path className="iso-line" data-tone="mid" d="M150 145 L210 105 L270 145 L210 185 Z" />
          </g>

          {/* Chip plane (lit) */}
          <g className="iso-solid" data-lit>
            <path className="iso-fill" d="M248 168 L318 128 L348 143 L278 183 Z" />
            <path className="iso-top" d="M248 168 L318 128 L348 143 L278 183 Z" />
            <path className="iso-line" data-tone="lit" d="M248 168 L318 128 L348 143 L278 183 Z" />
          </g>

          {/* Qubits + couplers */}
          {[
            [268, 158],
            [298, 142],
            [328, 158],
            [308, 172],
          ].map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r={5} fill="var(--anatomy-blue)" opacity={activeQubit === i ? 1 : 0.35} />
              {activeQubit === i && (
                <circle className="iso-pulse-ring" cx={cx} cy={cy} r={8} />
              )}
            </g>
          ))}

          {/* Microwave bus */}
          <path
            className="iso-line"
            data-tone="blue"
            data-flow
            d="M210 175 L248 168 L318 128"
          />
          <path className="iso-line" data-tone="green" data-flow d="M278 183 L320 210 L360 190" />

          {/* IO lines to console */}
          <path className="iso-line" data-tone="hi" d="M130 175 L70 205" />
          <path className="iso-line" data-tone="hi" d="M290 175 L350 205" />
          <circle cx={70} cy={205} r={3} fill="var(--anatomy-green)" />
          <circle cx={350} cy={205} r={3} fill="var(--anatomy-blue)" />

          {/* Dial readout on stand */}
          <g className="iso-solid">
            <path className="iso-shade" data-shade="2" d="M52 208 L72 198 L92 208 L72 218 Z" />
            <path className="iso-line" data-tone="hi" d="M52 208 L72 198 L92 208 L72 218 Z" />
            <path
              className="iso-line"
              data-tone="blue"
              d={`M72 208 L${72 + Math.cos((readout.t1 / 60) * Math.PI) * 14} ${208 - Math.sin((readout.t1 / 60) * Math.PI) * 10}`}
            />
          </g>
        </svg>
      </div>
      <figcaption className="iso-caption">
        Anatomy-style explainer — illustrative T1 needle and bus pulses. Platform metrics live in the operations console.
      </figcaption>
    </figure>
  );
}
