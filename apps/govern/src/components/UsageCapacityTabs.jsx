/** Shared tab strip — Capacity + Usage are one nav item, two views. */
export default function UsageCapacityTabs({ current, onOpen }) {
  return (
    <div className="qre-tabs page-toolbar-unified govern-merge-tabs" role="tablist" aria-label="Usage and capacity">
      <button
        type="button"
        role="tab"
        aria-selected={current === 'usage'}
        className={`qre-tab${current === 'usage' ? ' qre-tab--active' : ''}`}
        onClick={() => onOpen?.('#/usage')}
      >
        Quotas & ledger
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={current === 'capacity'}
        className={`qre-tab${current === 'capacity' ? ' qre-tab--active' : ''}`}
        onClick={() => onOpen?.('#/capacity')}
      >
        Capacity meters
      </button>
    </div>
  );
}
