import ForgeIntroBackground from './ForgeIntroBackground.jsx';
import CertPublicHeader from './CertPublicHeader.jsx';
import CertPublicFooter from './CertPublicFooter.jsx';

export default function CertPublicMarketingShell({ children, className = '', shellClassName = '', footer = undefined }) {
  return (
    <div className={`public-marketing-page${className ? ` ${className}` : ''}${shellClassName ? ` ${shellClassName}` : ''}`}>
      <ForgeIntroBackground />
      <div className="public-marketing-page__content">
        <CertPublicHeader className="public-marketing-page__header landing-page__header" />
        <main id="main-content" tabIndex={-1} className="public-marketing-page__main outline-none">
          {children}
        </main>
        {footer !== false ? footer ?? <CertPublicFooter className="landing-page__footer" /> : null}
      </div>
    </div>
  );
}
