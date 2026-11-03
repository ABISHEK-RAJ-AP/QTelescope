/**
 * Full-viewport public chrome (sign-in / register) — no operational sidebar.
 */
export default function QrePublicShell({
  brandTitle = 'QRP',
  productSubtitle = 'Quantum Resource Platform',
  children,
  headerActions = null,
}) {
  return (
    <div className="qre-public-shell">
      <header className="qre-public-shell__header">
        <div className="qre-public-shell__brand">
          <span className="qre-public-shell__mark" aria-hidden />
          <div>
            <span className="qre-public-shell__title">{brandTitle}</span>
            <span className="qre-public-shell__sub">{productSubtitle}</span>
          </div>
        </div>
        {headerActions ? <div className="qre-public-shell__header-actions">{headerActions}</div> : null}
      </header>
      <main className="qre-public-shell__main">{children}</main>
      <footer className="qre-public-shell__footer">
        <span>QRE platform · per-app sign-in · synced identity</span>
      </footer>
    </div>
  );
}
