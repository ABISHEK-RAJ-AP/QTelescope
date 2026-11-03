import { useEffect, useState } from 'react';
import CertStudioLoginWireBackdrop from './cert-studio/CertStudioLoginWireBackdrop.jsx';
import QrePublicMarketingShell from './QrePublicMarketingShell.jsx';
import QreMarketingContainer from './QreMarketingContainer.jsx';
import { CDAC_LOGO_SRC, GOVERN_PRODUCT_NAME } from './publicBrand.js';
import { readTheme, resolveDataTheme } from './theme.js';
import { isDevAuthAllowed, QRE_DEV_AUTH_HOST_ID } from './DevAuthLocalPanel.jsx';

/** Cert Studio auth: centred card (CertAuthShell parity). */
export default function QreAuthMarketingPage({
  activeAuth,
  title,
  subtitle,
  onHome,
  onSignIn,
  onRegister,
  onFooterNavigate,
  wide = false,
  children,
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [isDark, setIsDark] = useState(() => resolveDataTheme(readTheme()) !== 'light');
  const showDevHost = isDevAuthAllowed && activeAuth === 'sign-in';
  const cardClass = wide ? 'cert-register-card' : 'cert-login-card';
  const cardMax = wide ? 540 : 480;

  useEffect(() => {
    const sync = () => setIsDark(resolveDataTheme(readTheme()) !== 'light');
    sync();
    window.addEventListener('qre-theme-changed', sync);
    return () => window.removeEventListener('qre-theme-changed', sync);
  }, []);

  const fieldBridge = { setUsername, setPassword, setCaptchaInput };

  return (
    <QrePublicMarketingShell
      activeAuth={activeAuth}
      onHome={onHome}
      onSignIn={onSignIn}
      onRegister={onRegister}
      onFooterNavigate={onFooterNavigate}
    >
      <main id="main-content" className="cert-auth-page__main public-auth-page cert-auth-page--intro" tabIndex={-1}>
        <CertStudioLoginWireBackdrop
          email={username}
          password={password}
          captchaInput={captchaInput}
          variant={isDark ? 'dark' : 'light'}
        />
        <QreMarketingContainer
          className="cert-auth-page__container"
          style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: showDevHost ? 800 : cardMax,
            width: '100%',
          }}
        >
          <div className={`cert-auth-page__stage${showDevHost ? ' cert-auth-page__stage--with-dev' : ''}`}>
            <button type="button" className="cert-auth-inline-back" onClick={onHome}>
              ← Back to home
            </button>
            <div className={cardClass}>
              <img src={CDAC_LOGO_SRC} alt="" className="cert-login-card__logo" width={120} height={64} aria-hidden />
              <p className="cert-auth-card__wordmark">{GOVERN_PRODUCT_NAME}</p>
              <div className="cert-login-card__head">
                <h1>{title}</h1>
                {subtitle ? <p className="cert-login-card__subtitle">{subtitle}</p> : null}
              </div>
              {typeof children === 'function' ? children(fieldBridge) : children}
            </div>
            {showDevHost ? (
              <aside id={QRE_DEV_AUTH_HOST_ID} className="qre-dev-auth-host" aria-label="Temporary development sign-in" />
            ) : null}
          </div>
        </QreMarketingContainer>
      </main>
    </QrePublicMarketingShell>
  );
}
