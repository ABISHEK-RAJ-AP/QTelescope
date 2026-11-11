import React from 'react';
import { RefreshCw } from 'lucide-react';
import { formatISTTime } from '../../utils/time';

/** Center header refresh — last load time on hover/focus only (IST clock stays in header trailing). */
export function PageRefreshCluster({ onClick, lastRefreshAt = null, label = 'Refresh' }) {
  const stamp = lastRefreshAt ? formatISTTime(lastRefreshAt) : '—';
  const aria = lastRefreshAt ? `${label} · last loaded ${stamp}` : label;

  return (
    <button
      type="button"
      className="btn btn-secondary btn-icon-only"
      onClick={onClick}
      title={aria}
      aria-label={aria}
    >
      <RefreshCw size={14} aria-hidden />
    </button>
  );
}
