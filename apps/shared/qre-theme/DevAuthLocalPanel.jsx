import { useMemo } from 'react';
import { hasPlatformSession } from './auth.js';
import {
  DEMO_LOGIN_ROLES,
  DEV_HEADER_ROLES,
  demoCredentialsForRole,
  roleLabel,
} from './devAuthConfig.js';

export const DEV_AUTH_MANUAL = 'manual';

/** Temporary mount point outside the sign-in card. Delete with this panel. */
export const QRE_DEV_AUTH_HOST_ID = 'qre-dev-auth-host';

const ALLOW_DEV = import.meta.env.DEV && import.meta.env.VITE_QRE_DEV_HEADERS !== 'false';

/**
 * @typedef {'manual'|'demo'|'devHeaders'} DevAuthMode
 */

/**
 * Local dev sign-in helper (compact aside on auth pages).
 */
export default function DevAuthLocalPanel({
  mode,
  onModeChange,
  devRole,
  onDevRoleChange,
  demoRole,
  onDemoRoleChange,
  onContinueDevHeaders,
  onApplyDemoCredentials,
  devBusy = false,
  layout = 'inline',
}) {
  if (!ALLOW_DEV || hasPlatformSession()) return null;

  const selectValue = useMemo(() => {
    if (mode === 'manual') return DEV_AUTH_MANUAL;
    if (mode === 'demo' && demoRole) return `demo:${demoRole}`;
    if (mode === 'devHeaders' && devRole) return `dev:${devRole}`;
    return DEV_AUTH_MANUAL;
  }, [mode, devRole, demoRole]);

  function pickDemo(role) {
    onDemoRoleChange(role);
    onModeChange('demo');
    onApplyDemoCredentials?.(role);
  }

  function onSelectChange(e) {
    const v = e.target.value;
    if (v === DEV_AUTH_MANUAL) {
      onModeChange('manual');
      return;
    }
    if (v.startsWith('demo:')) {
      pickDemo(v.slice(5));
      return;
    }
    if (v.startsWith('dev:')) {
      const role = v.slice(4);
      onDevRoleChange(role);
      onModeChange('devHeaders');
    }
  }

  const aside = layout === 'aside';

  return (
    <div
      className={`qre-auth-gate__dev qre-dev-auth-panel${aside ? ' qre-dev-auth-panel--aside' : ''}`}
      aria-label={aside ? 'Development sign-in' : undefined}
    >
      <label className="qre-field qre-dev-auth-panel__select-wrap">
        {!aside ? null : (
          <span className="qre-dev-auth-panel__aside-title">Dev</span>
        )}
        <select
          className="qre-field__input qre-dev-auth-panel__select"
          value={selectValue}
          onChange={onSelectChange}
          aria-label="Development sign-in mode"
        >
          <option value={DEV_AUTH_MANUAL}>Credentials</option>
          <optgroup label="Demo (captcha only)">
            {DEMO_LOGIN_ROLES.map((r) => (
              <option key={`demo-${r}`} value={`demo:${r}`}>
                {roleLabel(r)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Role header">
            {DEV_HEADER_ROLES.map((r) => (
              <option key={`dev-${r}`} value={`dev:${r}`}>
                {roleLabel(r)}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      {mode === 'demo' ? (
        <div className="qre-dev-auth-panel__roles" role="group" aria-label="Demo accounts">
          {DEMO_LOGIN_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              className={`qre-dev-auth-panel__role${demoRole === r ? ' qre-dev-auth-panel__role--active' : ''}`}
              onClick={() => pickDemo(r)}
            >
              {roleLabel(r)}
            </button>
          ))}
        </div>
      ) : null}

      {mode === 'devHeaders' ? (
        <button
          type="button"
          className="qre-btn qre-btn--primary qre-dev-auth-panel__continue"
          onClick={onContinueDevHeaders}
          disabled={devBusy}
        >
          {devBusy ? 'Opening…' : 'Continue'}
        </button>
      ) : null}
    </div>
  );
}

export { ALLOW_DEV as isDevAuthAllowed };
