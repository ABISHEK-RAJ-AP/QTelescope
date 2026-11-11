import React from 'react';
import { ChevronRight } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip.jsx';

function splitBreadcrumbs(breadcrumbs, title) {
  const interactive = breadcrumbs.filter((c) => c.href || c.onClick);
  if (interactive.length > 0) {
    return { navCrumbs: interactive, kicker: null };
  }
  if (breadcrumbs.length >= 2 && breadcrumbs[breadcrumbs.length - 1].label === title) {
    return { navCrumbs: [], kicker: breadcrumbs[0].label };
  }
  if (breadcrumbs.length === 1 && breadcrumbs[0].label !== title) {
    return { navCrumbs: [], kicker: breadcrumbs[0].label };
  }
  return { navCrumbs: [], kicker: null };
}

export function PageHeader({
  breadcrumbs = [],
  title,
  description,
  backendId,
  lastUpdated,
  actions,
  trailing,
  help,
  embedded = false,
}) {
  const { navCrumbs, kicker } = splitBreadcrumbs(breadcrumbs, title);

  return (
    <header className={`page-header${embedded ? ' page-header--embedded' : ''}`}>
      {navCrumbs.length > 0 && (
        <nav className="page-header__crumbs" aria-label="Breadcrumb">
          <ol className="page-header__crumb-list">
            {navCrumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="page-header__crumb-item">
                {i > 0 && <ChevronRight size={12} className="page-header__crumb-sep" aria-hidden />}
                <button type="button" className="page-header__crumb-link" onClick={crumb.onClick}>
                  {crumb.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="page-header__row">
        <div className="page-header__main">
          {kicker && <p className="page-header__kicker">{kicker}</p>}
          <h1 className="page-header__title">
            {title}
            {description ? (
              <InfoTooltip label={`About ${title}`}>
                {description}
              </InfoTooltip>
            ) : null}
          </h1>
          {description && !embedded ? <p className="page-header__desc">{description}</p> : null}
          <div className="page-header__context">
            {backendId && (
              <span className="page-header__backend">
                Backend: <code>{backendId}</code>
              </span>
            )}
            {lastUpdated && (
              <span className="page-header__updated">Updated {lastUpdated}</span>
            )}
          </div>
        </div>
        <div className="page-header__actions page-header__actions--center">
          {help}
          {actions}
        </div>
        {trailing ? (
          <div className="page-header__trailing">
            {trailing}
          </div>
        ) : null}
      </div>
    </header>
  );
}
