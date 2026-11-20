import React from 'react';

const PRESETS = [
  { id: 'superadmin', label: 'Platform admin', username: 'superadmin' },
  { id: 'admin', label: 'Admin', username: 'admin' },
  { id: 'operator', label: 'Operator', username: 'user_researcher' },
];

const DEMO_PASSWORD = 'quantum2026';

/**
 * Lab-only quick-fill — collapsed by default so login stays clean on demo video.
 */
export function AuthDemoPresets({ visible, onSelect }) {
  if (!visible) return null;

  return (
    <details className="auth-demo-presets">
      <summary className="auth-demo-presets__summary">Preset accounts</summary>
      <div className="auth-demo-presets__grid" role="group" aria-label="Demo account shortcuts">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="auth-demo-presets__btn"
            onClick={() => onSelect?.(p.username, DEMO_PASSWORD)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </details>
  );
}