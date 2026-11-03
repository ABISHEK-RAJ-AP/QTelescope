import { useRef, useState } from 'react';
import CertStudioLandingWireBackdrop from './CertStudioLandingWireBackdrop.jsx';

/** Full-viewport Cert Studio wire hero — paths + spotlight follow cursor. */
export default function CertStudioLandingWireSection({ children }) {
  const ref = useRef(null);
  const [progress, setProgress] = useState(0.28);
  const [parallaxX, setParallaxX] = useState(0);
  const [parallaxY, setParallaxY] = useState(0);
  const [spot, setSpot] = useState({ x: '50%', y: '40%' });

  function onMove(e) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    setProgress(0.22 + nx * 0.78);
    setParallaxX((nx - 0.5) * 28);
    setParallaxY((ny - 0.5) * 18);
    setSpot({ x: `${nx * 100}%`, y: `${ny * 100}%` });
  }

  function onLeave() {
    setSpot({ x: '50%', y: '40%' });
    setParallaxX(0);
    setParallaxY(0);
    setProgress(0.35);
  }

  return (
    <section
      ref={ref}
      className="landing-hero landing-hero--wire"
      style={{ '--spot-x': spot.x, '--spot-y': spot.y }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      aria-label="Hero"
    >
      <CertStudioLandingWireBackdrop progress={progress} parallaxX={parallaxX} parallaxY={parallaxY} />
      <div className="landing-hero__wire-glow" aria-hidden />
      <div className="landing-hero__content landing-hero__float">{children}</div>
    </section>
  );
}
