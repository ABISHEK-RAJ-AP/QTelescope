import React from 'react';
import { Link } from 'react-router-dom';

/** Cert Studio–style auth trail: Home / Sign in / current step */
export function AuthBreadcrumb({ items }) {
  if (!items?.length) return null;
  return (
    <nav className="auth-breadcrumb" aria-label="Breadcrumb">
      <ol className="auth-breadcrumb__list">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="auth-breadcrumb__item">
            {i > 0 ? <span className="auth-breadcrumb__sep" aria-hidden>/</span> : null}
            {item.to ? (
              <Link to={item.to} className="auth-breadcrumb__link">{item.label}</Link>
            ) : (
              <span className="auth-breadcrumb__current" aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}