import { Link } from 'react-router-dom';
import CertPublicMarketingShell from './CertPublicMarketingShell.jsx';

export default function CertAuthShell({
  title,
  subtitle,
  backTo = '/landing',
  backLabel = 'Back to Home',
  children,
  maxWidth = 460,
  footer = null,
}) {
  return (
    <CertPublicMarketingShell shellClassName="cert-auth-page--intro public-auth-page">
      <Link to={backTo} className="cert-auth-inline-back">
        ← {backLabel}
      </Link>
      <div className="cert-login-card" style={{ maxWidth, width: '100%' }}>
        {(title || subtitle) && (
          <div className="cert-login-card__head">
            {title ? <h1>{title}</h1> : null}
            {subtitle ? <p className="cert-login-card__subtitle">{subtitle}</p> : null}
          </div>
        )}
        {children}
        {footer}
      </div>
    </CertPublicMarketingShell>
  );
}
