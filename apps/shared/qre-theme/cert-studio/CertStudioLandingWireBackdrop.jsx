import { useMemo } from 'react';
import { GEMINI_WIRE_PATHS } from './geminiWirePaths.js';

const BASE_FILL = 0.22;

function lineProgress(index, progress) {
  const stagger = index * 0.07;
  return Math.max(BASE_FILL, Math.min(1, (progress - stagger) / (1 - stagger + 0.01)));
}

/** Cert Studio `LandingWireBackdrop` — cursor-driven path fill + parallax. */
export default function CertStudioLandingWireBackdrop({ progress = BASE_FILL, parallaxX = 0, parallaxY = 0 }) {
  const paths = useMemo(
    () => GEMINI_WIRE_PATHS.map((path, index) => ({
      ...path,
      fill: lineProgress(index, progress),
    })),
    [progress],
  );

  return (
    <div className="landing-wire-backdrop" aria-hidden>
      <svg
        viewBox="0 0 1440 890"
        preserveAspectRatio="xMidYMid slice"
        className="landing-wire-backdrop__svg"
        style={{ transform: `translate(${parallaxX}px, ${parallaxY}px)` }}
      >
        <defs>
          <filter id="qreLandingWireBlur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
          </filter>
        </defs>

        {GEMINI_WIRE_PATHS.map((path) => (
          <path
            key={`blur-${path.stroke}`}
            d={path.d}
            fill="none"
            stroke={path.stroke}
            strokeWidth="2"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={0}
            opacity={0.35}
            filter="url(#qreLandingWireBlur)"
          />
        ))}

        {paths.map((path, index) => (
          <path
            key={`${path.stroke}-${index}`}
            d={path.d}
            fill="none"
            stroke={path.stroke}
            strokeWidth="2"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - path.fill}
            className="landing-wire-backdrop__path"
          />
        ))}
      </svg>
    </div>
  );
}
