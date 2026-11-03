import { createElement, isValidElement } from 'react';

/** Lucide (and similar) forwardRef icons are objects — never render the type as a child. */
export function renderNavIcon(icon, size = 18) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  if (typeof icon === 'function') return createElement(icon, { size });
  if (typeof icon === 'object' && icon !== null && typeof icon.render === 'function') {
    return createElement(icon, { size });
  }
  return null;
}
