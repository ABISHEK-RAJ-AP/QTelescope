import WorkspaceBadge from './WorkspaceBadge.jsx';

export default function GlobalHeader({
  workspaceId,
  title,
  showPageTitle = true,
  breadcrumbs = null,
  contextLine = null,
  contextBar = null,
  actions = null,
  themeControl = null,
  navToggle = null,
}) {
  return (
    <header className="qre-global-header">
      <div className="qre-global-header__row">
        <div className="qre-global-header__left">
          {navToggle}
          <WorkspaceBadge activeId={workspaceId} />
          <div className="qre-global-header__titles">
            {breadcrumbs}
            {showPageTitle && title ? <h1 className="qre-global-header__title">{title}</h1> : null}
            {contextLine && <p className="qre-global-header__context">{contextLine}</p>}
          </div>
        </div>
        <div className="qre-global-header__actions">
          {actions}
          {themeControl}
        </div>
      </div>
      {contextBar}
    </header>
  );
}
