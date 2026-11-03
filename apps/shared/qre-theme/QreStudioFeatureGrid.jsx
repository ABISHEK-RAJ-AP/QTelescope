/** Cert Studio landing feature cards (icon + hover lift + glass). */
export default function QreStudioFeatureGrid({ items = [], className = '' }) {
  return (
    <div className={`studio-feature-grid${className ? ` ${className}` : ''}`}>
      {items.map((item) => (
        <article key={item.title} className="studio-feature-card">
          <div className="studio-feature-card__shell">
            <div className="studio-feature-card__body">
              {item.icon ? (
                <div
                  className="studio-feature-card__icon"
                  style={{
                    color: item.accent || 'var(--primary)',
                    background: `color-mix(in srgb, ${item.accent || 'var(--primary)'} 12%, var(--surface))`,
                  }}
                >
                  {item.icon}
                </div>
              ) : null}
              <h3 className="studio-feature-card__title">{item.title}</h3>
              <p className="studio-feature-card__desc">{item.description}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
