import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { CDAC_LOGO_SRC, QFORGE_PRODUCT_NAME } from './constants.js';
import CertPublicThemeToggle from './CertPublicThemeToggle.jsx';

function NavAnchor({ link, className, onNavigate }) {
  const { pathname } = useLocation();
  const onLanding = pathname === '/landing' || pathname === '/';

  if (link.hash && onLanding) {
    return (
      <a href={link.href} className={className} onClick={onNavigate}>
        {link.label}
      </a>
    );
  }

  return (
    <Link to={link.href} className={className} onClick={onNavigate}>
      {link.label}
    </Link>
  );
}

export default function CertPublicHeader({ className = '', homeTo = '/landing' }) {
  const headerRef = useRef(null);
  const { pathname } = useLocation();
  const onLogin = pathname.startsWith('/login');
  const onRegister = pathname.startsWith('/register');
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Features', href: '/landing#capabilities', hash: true },
    { label: 'How It Works', href: '/landing#guide', hash: true },
    { label: 'FAQ', href: '/landing#faq', hash: true },
  ];

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

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

  return (
    <>
      <header ref={headerRef} className={`cert-public-header notranslate${className ? ` ${className}` : ''}`}>
        <div className="cert-public-header__inner">
          <Link to={homeTo} className="cert-public-header__brand">
            <img
              src={CDAC_LOGO_SRC}
              alt="Centre for Development of Advanced Computing (C-DAC)"
              className="cert-public-header__logo"
              width={100}
              height={48}
              loading="eager"
              decoding="async"
            />
            <span className="cert-public-header__title cert-public-header__title--product">{QFORGE_PRODUCT_NAME}</span>
          </Link>

          <nav className="cert-public-header__nav" aria-label="Page sections">
            {navLinks.map((link) => (
              <NavAnchor key={link.label} link={link} className="cert-public-header__nav-link" />
            ))}
          </nav>

          <div className="cert-public-header__actions">
            <nav className="cert-public-header__auth" aria-label="Account">
              <Link
                to="/login"
                className={`cert-public-header__auth-link${onLogin ? ' is-active' : ''}`}
                aria-current={onLogin ? 'page' : undefined}
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className={`cert-public-header__auth-link cert-public-header__auth-link--primary${onRegister ? ' is-active' : ''}`}
                aria-current={onRegister ? 'page' : undefined}
              >
                Get Started
              </Link>
            </nav>
            <CertPublicThemeToggle className="cert-public-header__theme" embedded />
            <button
              type="button"
              className="cert-public-header__menu-btn"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="cert-public-header-drawer"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
            </button>
          </div>
        </div>
      </header>

      <div
        id="cert-public-header-drawer"
        className={`cert-public-header__drawer${menuOpen ? ' is-open' : ''}`}
        aria-hidden={!menuOpen}
      >
        <button type="button" className="cert-public-header__drawer-backdrop" aria-label="Close menu" tabIndex={menuOpen ? 0 : -1} onClick={closeMenu} />
        <div className="cert-public-header__drawer-panel" role="dialog" aria-modal="true" aria-label="Site menu">
          <nav className="cert-public-header__drawer-nav" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <NavAnchor key={link.label} link={link} className="cert-public-header__drawer-link" onNavigate={closeMenu} />
            ))}
          </nav>
          <div className="cert-public-header__drawer-auth">
            <Link to="/login" className="cert-public-header__auth-link" onClick={closeMenu}>
              Sign in
            </Link>
            <Link to="/register" className="cert-public-header__auth-link cert-public-header__auth-link--primary" onClick={closeMenu}>
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
