export default function StudioFeatureGrid({ items }) {
  return (
    <div className="studio-feature-grid">
      {items.map((item) => (
        <article key={item.title} className="studio-feature-card">
          <div className="studio-feature-card__shell">
            <div className="studio-feature-card__body">
              <div
                className="studio-feature-card__icon"
                style={{
                  color: item.accent || 'var(--primary)',
                  background: `color-mix(in srgb, ${item.accent || 'var(--primary)'} 12%, var(--surface))`,
                }}
              >
                {item.icon}
              </div>
              <h3 className="studio-feature-card__title">{item.title}</h3>
              <p className="studio-feature-card__desc">{item.description}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
