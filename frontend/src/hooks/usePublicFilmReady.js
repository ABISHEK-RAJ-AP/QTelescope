import { useEffect } from 'react';
import { clearQtFilmReady, setQtFilmReady } from '../lib/qtFilmReady.js';

/** Public marketing / auth surfaces — static once hero is painted. */
export function usePublicFilmReady(scope = 'public') {
  useEffect(() => {
    const mark = () => setQtFilmReady({ path: window.location.pathname, scope });
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(mark);
    });
    return () => {
      cancelAnimationFrame(id);
      clearQtFilmReady();
    };
  }, [scope]);
}