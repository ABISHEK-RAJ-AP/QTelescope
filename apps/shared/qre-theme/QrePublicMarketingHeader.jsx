import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import QrePublicThemeToggle from './QrePublicThemeToggle.jsx';
import { CDAC_LOGO_SRC, GOVERN_PRODUCT_NAME } from './publicBrand.js';

const DEFAULT_NAV = [
  { label: 'Features', href: '#capabilities' },
  { label: 'How It Works', href: '#guide' },
  { label: 'FAQ', href: '#faq' },
];

function NavAnchor({ link, className, onNavigate }) {
  return (
    <a
      href={link.href}
      className={className}
      onClick={(e) => {
        if (link.href.startsWith('#')) {
          e.preventDefault();
          const id = link.href.slice(1);
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        onNavigate?.();
      }}
    >
      {link.label}
    </a>
  );
}

export default function QrePublicMarketingHeader({
  title = GOVERN_PRODUCT_NAME,
  className = '',
  activeAuth = null,
  onHome,
  onSignIn,
  onRegister,
  navLinks = DEFAULT_NAV,
  showAuthLinks = true,
}) {
  const headerRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [activeAuth, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return undefined;
    const setHeight = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--cert-public-header-height', `${h}px`);
    };
    setHeight();
    const ro = new ResizeObserver(setHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onLoginPage = activeAuth === 'sign-in';
  const onRegisterPage = activeAuth === 'register';

  return (
    <>
      <header ref={headerRef} className={`cert-public-header notranslate${className ? ` ${className}` : ''}`} translate="no">
        <div className="cert-public-header__inner">
          <button type="button" className="cert-public-header__brand" onClick={onHome}>
            <img
              src={CDAC_LOGO_SRC}
              alt="Centre for Development of Advanced Computing (C-DAC)"
              className="cert-public-header__logo"
              width={100}
              height={48}
              loading="eager"
              decoding="async"
            />
            <span className="cert-public-header__title cert-public-header__title--product">{title}</span>
          </button>

          <nav className="cert-public-header__nav" aria-label="Page sections">
            {navLinks.map((link) => (
              <NavAnchor key={link.label} link={link} className="cert-public-header__nav-link" />
            ))}
          </nav>

          <div className="cert-public-header__actions">
            {showAuthLinks ? (
              <nav className="cert-public-header__auth" aria-label="Account">
                <button
                  type="button"
                  className={`cert-public-header__auth-link${onLoginPage ? ' is-active' : ''}`}
                  onClick={onSignIn}
                  aria-current={onLoginPage ? 'page' : undefined}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={`cert-public-header__auth-link cert-public-header__auth-link--primary${onRegisterPage ? ' is-active' : ''}`}
                  onClick={onRegister}
                  aria-current={onRegisterPage ? 'page' : undefined}
                >
                  Get Started
                </button>
              </nav>
            ) : null}
            <QrePublicThemeToggle embedded />
            <button
              type="button"
              className="cert-public-header__menu-btn"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="qre-public-header-drawer"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
            </button>
          </div>
        </div>
      </header>

      <div id="qre-public-header-drawer" className={`cert-public-header__drawer${menuOpen ? ' is-open' : ''}`} aria-hidden={!menuOpen}>
        <button type="button" className="cert-public-header__drawer-backdrop" aria-label="Close menu" tabIndex={menuOpen ? 0 : -1} onClick={closeMenu} />
        <div className="cert-public-header__drawer-panel" role="dialog" aria-modal="true" aria-label="Site menu">
          <nav className="cert-public-header__drawer-nav" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <NavAnchor key={link.label} link={link} className="cert-public-header__drawer-link" onNavigate={closeMenu} />
            ))}
          </nav>
          <div className="cert-public-header__drawer-tools">
            <QrePublicThemeToggle embedded />
          </div>
          {showAuthLinks ? (
            <div className="cert-public-header__drawer-auth">
              <button type="button" className="cert-public-header__auth-link" onClick={() => { closeMenu(); onSignIn?.(); }}>
                Sign in
              </button>
              <button type="button" className="cert-public-header__auth-link cert-public-header__auth-link--primary" onClick={() => { closeMenu(); onRegister?.(); }}>
                Get Started
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
