/** SVG stroke-draw brand line (Cert Studio–style, CSS-driven). */
export default function PathDrawBrand({ brand, tagline, eyebrow = 'Quantum resource platform' }) {
  return (
    <div className="qre-path-brand">
      {eyebrow ? <p className="qre-path-brand__eyebrow">{eyebrow}</p> : null}
      <svg className="qre-path-brand__svg" viewBox="0 0 640 100" role="img" aria-label={brand}>
        <text className="qre-path-brand__stroke" x="320" y="68" textAnchor="middle">
          {brand}
        </text>
        <text className="qre-path-brand__fill" x="320" y="68" textAnchor="middle">
          {brand}
        </text>
      </svg>
      {tagline ? <p className="qre-path-brand__tagline">{tagline}</p> : null}
    </div>
  );
}
