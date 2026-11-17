import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { clearQtFilmReady, probeQtFilmReady, setQtFilmError, setQtFilmReady } from '../../lib/qtFilmReady.js';

const POLL_MS = 120;
const FAIL_MS = Number(import.meta.env.VITE_QT_FILM_FAIL_MS || 90_000);

/** Marks body[data-qt-ready] when console route is capture-safe. */
export function QtFilmReadyWatcher() {
  const { pathname } = useLocation();

  useEffect(() => {
    clearQtFilmReady();
    const started = Date.now();
    let tick = null;
    let failTimer = null;

    const run = () => {
      const probe = probeQtFilmReady();
      if (probe.ready) {
        setQtFilmReady({ path: pathname, reasons: probe.reasons });
        if (tick) clearInterval(tick);
        if (failTimer) clearTimeout(failTimer);
        return;
      }
      if (Date.now() - started > FAIL_MS) {
        setQtFilmError({ path: pathname, reasons: probe.reasons });
      }
    };

    const boot = async () => {
      try {
        if (document.fonts?.ready) await document.fonts.ready;
      } catch {
        /* ignore */
      }
      run();
      tick = setInterval(run, POLL_MS);
      failTimer = setTimeout(run, FAIL_MS);
    };

    boot();
    return () => {
      if (tick) clearInterval(tick);
      if (failTimer) clearTimeout(failTimer);
      clearQtFilmReady();
    };
  }, [pathname]);

  return null;
}