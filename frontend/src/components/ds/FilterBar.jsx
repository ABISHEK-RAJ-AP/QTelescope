import React from 'react';
import { Search } from 'lucide-react';
import './FilterBar.css';

/**
 * Compact filter toolbar — search + inline filters + optional count line.
 * Ponytail: one pattern for alerts, inventory, and future grids.
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  searchLabel = 'Search',
  children,
  count,
  countRole = 'status',
  actions,
  className = '',
}) {
  return (
    <div className={`filter-bar ${className}`.trim()} role="search">
      {onSearchChange != null ? (
        <label className="filter-bar__search">
          <Search size={14} aria-hidden />
          <span className="sr-only">{searchLabel}</span>
          <input
            type="search"
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>
      ) : null}
      {children ? <div className="filter-bar__filters">{children}</div> : null}
      {actions ? <div className="filter-bar__actions">{actions}</div> : null}
      {count ? (
        <span className="filter-bar__count" role={countRole} aria-live="polite">
          {count}
        </span>
      ) : null}
    </div>
  );
}
