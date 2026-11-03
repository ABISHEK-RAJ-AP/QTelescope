import { useState } from 'react';
import CertStudioLoginWireBackdrop from './cert-studio/CertStudioLoginWireBackdrop.jsx';
import PathDrawBrand from './PathDrawBrand.jsx';
import QrePublicNav from './QrePublicNav.jsx';
import { readTheme, resolveDataTheme } from './theme.js';

/** Cert Studio auth page: full-viewport wire + glass panel. */
export default function QreCertAuthLayout({
  navActive,
  onHome,
  onSignIn,
  onRegister,
  pathBrand,
  pathTagline,
  heroTitle,
  heroLead,
  panelTitle,
  children,
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const theme = readTheme();
  const isDark = resolveDataTheme(theme) !== 'light';

  const fieldBridge = {
    setUsername,
    setPassword,
    setCaptchaInput,
  };

  return (
    <div className="qre-forge-auth qre-cert-auth-page login-page-main landing-page">
      <CertStudioLoginWireBackdrop
        email={username}
        password={password}
        captchaInput={captchaInput}
        variant={isDark ? 'dark' : 'light'}
      />
      <header className="qre-cert-auth-page__top qre-build-landing__fade landing-page__content">
        <div className="qre-build-landing__brand">
          <div>
            <strong>QRP</strong>
            <span className="qre-build-landing__brand-sub">Govern</span>
          </div>
        </div>
        <QrePublicNav active={navActive} onHome={onHome} onSignIn={onSignIn} onRegister={onRegister} />
      </header>
      <div className="qre-forge-auth__inner qre-forge-auth__inner--animate landing-page__content">
        <div className="qre-forge-auth__hero">
          <PathDrawBrand brand={pathBrand} eyebrow="Cert Studio wire motion" tagline={pathTagline} />
          <p className="qre-forge-auth__eyebrow">Quantum Resource Platform</p>
          <h1 className="qre-forge-auth__title">{heroTitle}</h1>
          <p className="qre-forge-auth__lead">{heroLead}</p>
        </div>
        <div className="qre-forge-auth__panel qre-forge-auth__panel--animate login-auth-card">
          <h2 className="qre-forge-auth__panel-title">{panelTitle}</h2>
          {typeof children === 'function' ? children(fieldBridge) : children}
        </div>
      </div>
    </div>
  );
}
