import { useCallback, useEffect, useState } from 'react';

function readStored(key, fallback) {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

/** Vertical resize from top edge (drag up = taller panel). */
export default function useDragHeight(storageKey, { defaultHeight = 220, min = 120, max = 480 } = {}) {
  const [height, setHeight] = useState(() => readStored(storageKey, defaultHeight));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(height));
    } catch {
      /* ignore */
    }
  }, [storageKey, height]);

  const onResizePointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const startY = e.clientY;
      const startH = height;

      function onMove(ev) {
        const next = Math.min(max, Math.max(min, startH + (startY - ev.clientY)));
        setHeight(next);
      }
      function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [height, min, max],
  );

  return { height, setHeight, onResizePointerDown };
}
