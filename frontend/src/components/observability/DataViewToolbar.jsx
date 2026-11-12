import React from 'react';
import { CalendarDays, LayoutGrid, List } from 'lucide-react';
import './dataViewToolbar.css';

export function toggleSortKey(prev, key, defaultDir = 'asc') {
  if (prev.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: defaultDir };
}

export function SortableTh({
  sort,
  sortKey,
  onToggle,
  children,
  scope = 'col',
  className,
  defaultDir = 'asc',
}) {
  const active = sort.key === sortKey;
  return (
    <th
      scope={scope}
      className={className}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="dvt-sort"
        onClick={() => onToggle(toggleSortKey(sort, sortKey, defaultDir))}
      >
        {children}
        {active && (sort.dir === 'asc' ? ' ▲' : ' ▼')}
      </button>
    </th>
  );
}

export function ViewModeToggle({
  value,
  onChange,
  toggleClassName = 'dvt-view-toggle',
  btnClassName = 'dvt-view-btn',
  ariaLabel = 'Layout',
  includeCalendar = false,
}) {
  return (
    <div className={toggleClassName} role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className={`${btnClassName}${value === 'grid' ? ' is-active' : ''}`}
        aria-pressed={value === 'grid'}
        title="Grid"
        onClick={() => onChange('grid')}
      >
        <LayoutGrid size={16} aria-hidden />
      </button>
      <button
        type="button"
        className={`${btnClassName}${value === 'table' ? ' is-active' : ''}`}
        aria-pressed={value === 'table'}
        title="Table"
        onClick={() => onChange('table')}
      >
        <List size={16} aria-hidden />
      </button>
      {includeCalendar ? (
        <button
          type="button"
          className={`${btnClassName}${value === 'calendar' ? ' is-active' : ''}`}
          aria-pressed={value === 'calendar'}
          title="Calendar"
          onClick={() => onChange('calendar')}
        >
          <CalendarDays size={16} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function DataPanelToolbar({ title, hint, children, layout, onLayoutChange, countLabel, showLayoutToggle = true }) {
  const bar = (
    <div className="dvt-toolbar" role="toolbar">
      {children}
      {showLayoutToggle && onLayoutChange && (
        <ViewModeToggle value={layout} onChange={onLayoutChange} />
      )}
      {countLabel != null && countLabel !== '' && (
        <span className="dvt-toolbar__count" role="status">{countLabel}</span>
      )}
    </div>
  );
  if (!title && !hint) return bar;
  return (
    <div className="dvt-panel__head">
      <div className="dvt-panel__titles">
        {title ? <h3 className="dvt-panel__title">{title}</h3> : null}
        {hint ? <p className="dvt-panel__hint">{hint}</p> : null}
      </div>
      {bar}
    </div>
  );
}
