/** Card grid for list pages when layout !== table. Respects column visibility via fields. */
export default function RecordGrid({ items, rowKey, onRowClick, children }) {
  return (
    <ul className="govern-record-grid">
      {items.map((item) => {
        const key = rowKey(item);
        return (
          <li key={key}>
            <div
              className="govern-record-grid__card"
              onClick={() => onRowClick?.(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick?.(item);
                }
              }}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? 'button' : undefined}
            >
              {children(item)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function GridField({ label, children, wide = false }) {
  if (children == null || children === false) return null;
  return (
    <div className={`govern-record-grid__field${wide ? ' govern-record-grid__field--wide' : ''}`}>
      <span className="govern-record-grid__label">{label}</span>
      <div className="govern-record-grid__value">{children}</div>
    </div>
  );
}
