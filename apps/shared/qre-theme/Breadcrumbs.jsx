export default function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav className="qre-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={item.label}>
            {i > 0 && <span className="qre-breadcrumbs__sep">/</span>}
            {last || !item.href ? (
              <span className="qre-breadcrumbs__current">{item.label}</span>
            ) : (
              <a className="qre-breadcrumbs__link" href={item.href} onClick={item.onClick}>
                {item.label}
              </a>
            )}
          </span>
        );
      })}
    </nav>
  );
}
