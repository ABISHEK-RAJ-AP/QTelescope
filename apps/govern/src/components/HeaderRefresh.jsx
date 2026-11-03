import { RefreshCw } from 'lucide-react';

export default function HeaderRefresh({ labeled = false, loading = false }) {
  return (
    <button
      type="button"
      className={labeled ? 'qre-btn qre-btn--ghost qre-btn--sm' : 'dashboard-refresh-btn'}
      title="Refresh"
      aria-label="Refresh"
      disabled={loading}
      onClick={() => window.dispatchEvent(new CustomEvent('qre-page-refresh'))}
    >
      <RefreshCw size={16} className={loading ? 'dashboard-spin' : ''} />
      {labeled ? ' Refresh' : null}
    </button>
  );
}
