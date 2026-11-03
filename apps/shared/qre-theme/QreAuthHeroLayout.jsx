import KineticMatrixHero from './KineticMatrixHero.jsx';
import PathDrawBrand from './PathDrawBrand.jsx';

/** Split auth page: animated hero + sign-in panel (shared across Govern / Forge). */
export default function QreAuthHeroLayout({
  heroTitle = 'QRP',
  pathBrand = 'Govern',
  pathTagline = 'Approvals, inventory, policy, and evidence',
  panelTitle,
  children,
}) {
  return (
    <div className="qre-auth-split">
      <div className="qre-auth-split__hero">
        <KineticMatrixHero title={heroTitle} />
        <div className="qre-auth-split__path">
          <PathDrawBrand brand={pathBrand} tagline={pathTagline} />
        </div>
      </div>
      <div className="qre-auth-split__panel">
        <div className="qre-auth-gate__card qre-auth-gate__card--panel">
          {panelTitle ? <h1 className="qre-auth-gate__title">{panelTitle}</h1> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
