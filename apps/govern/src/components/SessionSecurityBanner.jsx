import { hasPlatformSession } from '@qre-theme/auth.js';

/** S0 pilot: surface when Govern runs on dev headers without API token. */
export default function SessionSecurityBanner({ me }) {
  const devOnly = import.meta.env.DEV && import.meta.env.VITE_QRE_DEV_HEADERS !== 'false';
  if (!devOnly) return null;
  if (me?.authenticated && hasPlatformSession()) return null;
  if (me?.authenticated) return null;

  const devSession = me?.dev_session;
  if (!devSession && !hasPlatformSession()) {
    return (
      <div className="govern-security-banner" role="status">
        Sign in with platform credentials for production-like RBAC. Dev header mode is not valid when{' '}
        <code>ENFORCE_RBAC=true</code>.
      </div>
    );
  }
  if (devSession && !hasPlatformSession()) {
    return (
      <div className="govern-security-banner govern-security-banner--warn" role="status">
        Dev session active (role headers). For pilot S0, use Sign in so <code>/auth/me</code> drives permissions.
      </div>
    );
  }
  return null;
}
