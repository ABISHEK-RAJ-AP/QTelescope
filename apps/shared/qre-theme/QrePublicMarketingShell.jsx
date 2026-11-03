import CertStudioIntroScene from './cert-studio/CertStudioIntroScene.jsx';
import QrePublicMarketingHeader from './QrePublicMarketingHeader.jsx';
import QrePublicMarketingFooter from './QrePublicMarketingFooter.jsx';

/** Cert Studio landing shell: intro backdrop + sticky header + footer. */
export default function QrePublicMarketingShell({
  children,
  activeAuth = null,
  onHome,
  onSignIn,
  onRegister,
  onFooterNavigate,
  headerClassName = 'landing-page__header',
}) {
  return (
    <div className="landing-page">
      <a href="#main-content" className="qre-skip-link">
        Skip to main content
      </a>
      <CertStudioIntroScene />
      <QrePublicMarketingHeader
        className={headerClassName}
        activeAuth={activeAuth}
        onHome={onHome}
        onSignIn={onSignIn}
        onRegister={onRegister}
      />
      <div className="landing-page__content">
        {children}
        <QrePublicMarketingFooter onNavigate={onFooterNavigate} />
      </div>
    </div>
  );
}
