import { useEffect, useState } from 'react';
import KineticMatrixHero from '@qre-theme/KineticMatrixHero.jsx';
import { readTheme } from '@qre-theme/theme.js';

export default function ForgeIntroBackground() {
  const [theme, setTheme] = useState(readTheme);
  const dark = theme === 'dark' || theme === 'high-contrast';

  useEffect(() => {
    const sync = () => setTheme(readTheme());
    window.addEventListener('qre-theme-changed', sync);
    return () => window.removeEventListener('qre-theme-changed', sync);
  }, []);

  return (
    <div className="intro-scene-bg" aria-hidden>
      <div className={`intro-scene-bg__layer intro-scene-bg__layer--light${dark ? ' is-fading-out' : ''}`}>
        <div className="intro-scene-bg__light-gradient" />
        {!dark ? <KineticMatrixHero title="0x10" className="intro-scene-bg__vine" showHud={false} /> : null}
      </div>
      {dark ? (
        <div className="intro-scene-bg__layer intro-scene-bg__layer--dark">
          <div className="living-vine-bg__static" />
          <KineticMatrixHero title="0x10" className="intro-scene-bg__vine" showHud={false} />
        </div>
      ) : null}
    </div>
  );
}
