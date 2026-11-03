import { useEffect, useState } from 'react';
import { readTheme, resolveDataTheme } from '../theme.js';
import { prefersReducedMotion } from '../motionPrefs.js';
import CertStudioBlueParticleWeb from './CertStudioBlueParticleWeb.jsx';
import CertStudioLoginWireBackdrop from './CertStudioLoginWireBackdrop.jsx';

/** Public marketing backdrop — single layer per theme (no crossfade flash). */
export default function CertStudioIntroScene() {
  const [isDark, setIsDark] = useState(() => resolveDataTheme(readTheme()) !== 'light');
  const showAnimatedBg = !prefersReducedMotion();

  useEffect(() => {
    const sync = () => setIsDark(resolveDataTheme(readTheme()) !== 'light');
    sync();
    window.addEventListener('qre-theme-changed', sync);
    return () => window.removeEventListener('qre-theme-changed', sync);
  }, []);

  return (
    <div className="intro-scene-bg" aria-hidden>
      <div className={`intro-scene-bg__layer intro-scene-bg__layer--${isDark ? 'dark' : 'light'}`}>
        {isDark ? (
          showAnimatedBg ? (
            <CertStudioLoginWireBackdrop variant="dark" progress={0.72} />
          ) : (
            <div className="landing-hero-canvas-fallback landing-hero-canvas-fallback--dark" />
          )
        ) : showAnimatedBg ? (
          <>
            <div className="intro-scene-bg__light-gradient" />
            <CertStudioBlueParticleWeb />
          </>
        ) : (
          <div className="landing-hero-canvas-fallback" />
        )}
      </div>
    </div>
  );
}
