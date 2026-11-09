import { useEffect } from 'react';
import { loadA11yPrefs } from '../../lib/accessibilityPrefs.js';

/**
 * Persistent a11y behaviors that must keep running after the options panel closes.
 * (Reading line, TTS, big-cursor overlay.)
 */
const systemReducedMotion = () => (
  typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
);

export function A11yRuntimeEffects() {
  useEffect(() => {
    let prefs = loadA11yPrefs();
    const syncPrefs = (e) => {
      prefs = e?.detail ? { ...prefs, ...e.detail } : loadA11yPrefs();
      const reduced = systemReducedMotion();
      document.documentElement.classList.toggle('a11y-big-cursor-on', Boolean(prefs.bigCursor) && !reduced);
    };
    window.addEventListener('qtelescope-a11y-changed', syncPrefs);
    syncPrefs();

    const onMove = (e) => {
      if (systemReducedMotion()) return;
      if (prefs.adhdMode) {
        document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
      }
      if (prefs.bigCursor) {
        document.documentElement.style.setProperty('--a11y-cursor-x', `${e.clientX}px`);
        document.documentElement.style.setProperty('--a11y-cursor-y', `${e.clientY}px`);
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    let ttsTimeout;
    const onMouseOver = (e) => {
      if (!prefs.textToSpeech) return;
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.closest?.('.fd-ceg-popover, .a11y-preheader, .osk-root')) return;
      const text = (t.getAttribute?.('aria-label') || t.innerText || '').trim();
      if (!text || text.length < 2 || text.length > 400) return;
      clearTimeout(ttsTimeout);
      ttsTimeout = setTimeout(() => {
        try {
          window.speechSynthesis?.cancel();
          const u = new SpeechSynthesisUtterance(text.slice(0, 220));
          u.lang = document.documentElement.lang || 'en-IN';
          u.rate = 0.95;
          window.speechSynthesis?.speak(u);
        } catch {
          /* ignore */
        }
      }, 450);
    };
    document.addEventListener('mouseover', onMouseOver, true);

    return () => {
      window.removeEventListener('qtelescope-a11y-changed', syncPrefs);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onMouseOver, true);
      clearTimeout(ttsTimeout);
      window.speechSynthesis?.cancel();
    };
  }, []);

  return null;
}
