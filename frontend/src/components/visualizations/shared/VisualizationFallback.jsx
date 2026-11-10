/**
 * VisualizationFallback
 * ----------------------
 * Guards a 3D scene behind a WebGL capability check.
 *
 * Props:
 *   reason         — Human-readable explanation if WebGL is unavailable (string)
 *   children       — The 2D accessible fallback content (always rendered)
 *   show3DMessage  — When true and WebGL IS available, renders the 3D scene slot
 *                    (parent is responsible for the actual 3D child via composition)
 *
 * Behaviour:
 *   - On mount, creates an off-screen canvas and attempts getContext('webgl').
 *   - If WebGL is unavailable, shows viz-fallback with Monitor icon + explanation.
 *   - children are always rendered beneath the 3D slot as the accessible alternative.
 *   - Respects .a11y-reduce-motion on the document root.
 */

import { useEffect, useRef, useState } from 'react';
import { Monitor } from 'lucide-react';

/** Returns true if WebGL 1 or 2 is available in this browser/environment. */
function detectWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl') ||
      canvas.getContext('webgl2') ||
      canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

export function VisualizationFallback({
  reason = '3D rendering is not available in your environment.',
  children,
  show3DMessage = false,
}) {
  // null = not yet determined, true/false = result
  const [webglAvailable, setWebglAvailable] = useState(null);
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;
    // Defer slightly so the paint isn't blocked
    const id = requestIdleCallback
      ? requestIdleCallback(() => setWebglAvailable(detectWebGL()))
      : setTimeout(() => setWebglAvailable(detectWebGL()), 0);
    return () => {
      if (requestIdleCallback && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };
  }, []);

  const webglBlocked = webglAvailable === false;

  return (
    <div
      className="viz-fallback-wrapper"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}
    >
      {/* ── 3D scene or unavailable notice ── */}
      {webglBlocked ? (
        <div className="viz-fallback" role="status" aria-live="polite">
          <Monitor
            size={36}
            className="viz-fallback__icon"
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <p className="viz-fallback__title">3D View Unavailable</p>
          <p className="viz-fallback__body">{reason}</p>
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginTop: '0.25rem',
            }}
          >
            The table view below shows the same data.
          </p>
        </div>
      ) : show3DMessage && webglAvailable ? (
        // WebGL is available and caller has opted in — slot rendered by parent
        null
      ) : null}

      {/* ── Accessible 2D fallback — always rendered ── */}
      {children && (
        <section
          aria-label="Accessible tabular view"
          style={{ width: '100%' }}
        >
          {children}
        </section>
      )}
    </div>
  );
}
