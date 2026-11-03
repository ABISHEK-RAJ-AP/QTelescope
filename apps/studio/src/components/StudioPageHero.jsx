export default function StudioPageHero({ eyebrow, title, subtitle, chips = [], actions }) {
  return (
    <header className="qre-studio-hero">
      <div>
        {eyebrow && <p className="qre-studio-hero__eyebrow">{eyebrow}</p>}
        <h1 className="qre-studio-hero__title">{title}</h1>
        {subtitle && <p className="qre-studio-hero__sub">{subtitle}</p>}
        {chips.length > 0 && (
          <div className="qre-studio-hero__meta">
            {chips.map((c) => (
              <span key={c.label} className={`qre-studio-chip${c.variant ? ` qre-studio-chip--${c.variant}` : ''}`}>
                {c.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {actions && <div className="qre-studio-panel__actions">{actions}</div>}
    </header>
  );
}
