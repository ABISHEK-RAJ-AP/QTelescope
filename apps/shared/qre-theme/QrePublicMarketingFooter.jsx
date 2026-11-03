import { useEffect, useState } from 'react';
import { CDAC_HOME_URL, CDAC_LOGO_SRC, GOVERN_PRODUCT_NAME, GOVERN_PUBLIC_TAGLINE } from './publicBrand.js';
import { readTheme, resolveDataTheme } from './theme.js';

const FOOTER_SECTIONS = [
  {
    title: 'Product',
    links: [
      { name: 'Overview', href: '#/' },
      { name: 'Features', href: '#capabilities' },
      { name: 'Sign in', href: '#/sign-in' },
    ],
  },
  {
    title: 'Workspace',
    links: [
      { name: 'How it works', href: '#guide' },
      { name: 'Register', href: '#/register' },
      { name: 'Portal tools', href: '#features' },
      { name: 'Platform', href: '#platform' },
    ],
  },
  {
    title: 'Help',
    links: [{ name: 'FAQ', href: '#faq' }],
  },
];

function FooterLink({ link, onNavigate }) {
  const className = 'cert-public-footer__link notranslate';
  return (
    <a
      href={link.href}
      className={className}
      translate="no"
      onClick={(e) => {
        if (onNavigate && link.href.startsWith('#')) {
          e.preventDefault();
          onNavigate(link.href);
        }
      }}
    >
      {link.name}
    </a>
  );
}

export default function QrePublicMarketingFooter({ className = '', onNavigate }) {
  const year = new Date().getFullYear();
  const [variant, setVariant] = useState(() => (resolveDataTheme(readTheme()) !== 'light' ? 'dark' : 'light'));

  useEffect(() => {
    const sync = () => setVariant(resolveDataTheme(readTheme()) !== 'light' ? 'dark' : 'light');
    sync();
    window.addEventListener('qre-theme-changed', sync);
    return () => window.removeEventListener('qre-theme-changed', sync);
  }, []);

  return (
    <footer
      className={`cert-public-footer cert-public-footer--${variant} notranslate landing-page__footer${className ? ` ${className}` : ''}`}
      aria-label="Site footer"
      translate="no"
    >
      <div className="cert-public-footer__container">
        <div className="cert-public-footer__main">
          <div className="cert-public-footer__brand">
            <h2 className="cert-public-footer__title">
              <a
                href="#/"
                className="cert-public-footer__title-link notranslate"
                translate="no"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate?.('#/');
                }}
              >
                {GOVERN_PRODUCT_NAME}
              </a>
            </h2>
            <p className="cert-public-footer__desc">{GOVERN_PUBLIC_TAGLINE}</p>
          </div>
          <div className="cert-public-footer__columns">
            {FOOTER_SECTIONS.map((section) => (
              <div key={section.title} className="cert-public-footer__col">
                <h3 className="cert-public-footer__col-title">{section.title}</h3>
                <ul className="cert-public-footer__col-links">
                  {section.links.map((link) => (
                    <li key={`${section.title}-${link.name}`}>
                      <FooterLink link={link} onNavigate={onNavigate} />
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
                href={CDAC_HOME_URL}
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
