import React from 'react';
import { RefreshCw } from 'lucide-react';
import { formatISTTime } from '../../utils/time';

/** Icon refresh — last load time on hover/focus only (header already shows live IST clock). */
export function RefreshButton({
  onClick,
  lastRefreshAt = null,
  label = 'Refresh',
  className = '',
}) {
  const title = lastRefreshAt
    ? `${label} · last loaded ${formatISTTime(lastRefreshAt)}`
    : label;

  return (
    <button
      type="button"
      className={`btn btn-secondary btn-icon-only ${className}`.trim()}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <RefreshCw size={14} aria-hidden />
    </button>
  );
}
