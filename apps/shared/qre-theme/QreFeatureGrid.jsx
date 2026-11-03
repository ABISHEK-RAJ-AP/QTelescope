/** Cert Studio–style feature grid (studio-feature-grid pattern). */
export default function QreFeatureGrid({ items = [] }) {
  return (
    <div className="qre-feature-grid">
      {items.map((item) => (
        <article key={item.title} className="qre-feature-card">
          <div className="qre-feature-card__body">
            {item.accent ? (
              <p className="qre-feature-card__meta" style={{ color: item.accent }}>
                {item.kicker || 'Capability'}
              </p>
            ) : null}
            <p className="qre-feature-card__title">{item.title}</p>
            <p className="qre-feature-card__desc">
              {item.description || item.desc || item.body}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
