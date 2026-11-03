/** Cert Studio–style public top nav — separate routes, no workspace dropdown. */
export default function QrePublicNav({ active = 'home', onHome, onSignIn, onRegister }) {
  return (
    <nav className="qre-public-nav" aria-label="Public">
      <button type="button" className={`qre-public-nav__link${active === 'home' ? ' qre-public-nav__link--active' : ''}`} onClick={onHome}>
        Home
      </button>
      <button type="button" className={`qre-public-nav__link${active === 'sign-in' ? ' qre-public-nav__link--active' : ''}`} onClick={onSignIn}>
        Sign in
      </button>
      <button type="button" className={`qre-public-nav__link${active === 'register' ? ' qre-public-nav__link--active' : ''}`} onClick={onRegister}>
        Register
      </button>
    </nav>
  );
}
