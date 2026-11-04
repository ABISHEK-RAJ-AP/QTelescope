import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CDAC_LOGO_SRC, QFORGE_PRODUCT_NAME, QFORGE_TAGLINE } from './constants.js';
import { readTheme, resolveDataTheme } from '@qre-theme/theme.js';

const FOOTER_SECTIONS = [
  {
    title: 'Product',
    links: [
      { name: 'Overview', href: '/landing' },
      { name: 'Features', href: '/landing#capabilities' },
      { name: 'How it works', href: '/landing#guide' },
    ],
  },
  {
    title: 'Workspace',
    links: [
      { name: 'Sign in', href: '/login' },
      { name: 'Register', href: '/register' },
      { name: 'Projects home', href: '/' },
    ],
  },
  {
    title: 'Help',
    links: [
      { name: 'FAQ', href: '/landing#faq' },
      { name: 'Create account', href: '/register' },
      { name: 'Open studio', href: '/login' },
    ],
  },
];

function FooterLink({ link }) {
  const className = 'cert-public-footer__link notranslate';
  if (link.href.includes('#')) {
    const [pathname, hash] = link.href.split('#');
    return (
      <Link to={{ pathname, hash: hash ? `#${hash}` : undefined }} className={className}>
        {link.name}
      </Link>
    );
  }
  return (
    <Link to={link.href} className={className}>
      {link.name}
    </Link>
  );
}

export default function CertPublicFooter({ className = '' }) {
  const year = new Date().getFullYear();
  const [variant, setVariant] = useState(() => (resolveDataTheme(readTheme()) === 'dark' ? 'dark' : 'light'));

  useEffect(() => {
    const sync = () => setVariant(resolveDataTheme(readTheme()) === 'dark' ? 'dark' : 'light');
    sync();
    window.addEventListener('qre-theme-changed', sync);
    return () => window.removeEventListener('qre-theme-changed', sync);
  }, []);

  return (
    <footer
      className={`cert-public-footer cert-public-footer--${variant} notranslate${className ? ` ${className}` : ''}`}
      aria-label="Site footer"
    >
      <div className="cert-public-footer__container">
        <div className="cert-public-footer__main">
          <div className="cert-public-footer__brand">
            <h2 className="cert-public-footer__title">
              <Link to="/landing" className="cert-public-footer__title-link notranslate">
                {QFORGE_PRODUCT_NAME}
              </Link>
            </h2>
            <p className="cert-public-footer__desc">
              {QFORGE_TAGLINE}. Design circuits, simulate with shot quotas, compile with preflight checks, and package
              governed submissions from one development studio.
            </p>
          </div>
          <div className="cert-public-footer__columns">
            {FOOTER_SECTIONS.map((section) => (
              <div key={section.title} className="cert-public-footer__col">
                <h3 className="cert-public-footer__col-title">{section.title}</h3>
                <ul className="cert-public-footer__col-links">
                  {section.links.map((link) => (
                    <li key={`${section.title}-${link.name}`}>
                      <FooterLink link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="cert-public-footer__bar">
          <p className="cert-public-footer__copy">
            © {year} Centre for Development of Advanced Computing (C-DAC). All rights reserved.
          </p>
          <div className="cert-public-footer__bar-end">
            <nav className="cert-public-footer__gov-logos" aria-label="Government partners">
              <a
                href="https://www.cdac.in/"
                target="_blank"
                rel="noopener noreferrer"
                title="Centre for Development of Advanced Computing (C-DAC)"
                className="cert-public-footer__gov-logo--transparent"
              >
                <img src={CDAC_LOGO_SRC} alt="C-DAC" loading="lazy" />
              </a>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
