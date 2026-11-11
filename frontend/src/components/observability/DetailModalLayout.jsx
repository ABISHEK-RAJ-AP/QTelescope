import React from 'react';

/** Structured body for centered detail modals (jobs, queues, alerts, …). */
export function DetailModalBody({ children, className = '' }) {
  return <div className={`dm-detail${className ? ` ${className}` : ''}`}>{children}</div>;
}

export function DetailModalHero({ children, note }) {
  return (
    <div className="dm-detail__hero">
      {children}
      {note ? <p className="dm-detail__note">{note}</p> : null}
    </div>
  );
}

export function DetailModalSection({ title, children }) {
  return (
    <section className="dm-detail__section">
      {title ? <h3 className="dm-detail__section-title">{title}</h3> : null}
      {children}
    </section>
  );
}

export function DetailModalDl({ children, className = '' }) {
  return <dl className={`dm-detail__dl${className ? ` ${className}` : ''}`}>{children}</dl>;
}

export function DetailModalRow({ label, children }) {
  return (
    <div className="dm-detail__field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** items: { label, value, known? } — known=false styles as “not recorded”. */
export function DetailModalTimeline({ items }) {
  return (
    <ol className="dm-detail__timeline">
      {items.map((e) => (
        <li key={e.label} data-known={e.known !== false ? 'true' : 'false'}>
          <b>{e.label}</b>
          <span>{e.value}</span>
        </li>
      ))}
    </ol>
  );
}

export function DetailModalRelated({ children }) {
  return (
    <DetailModalSection title="Related">
      <nav className="link-row page-related-nav dm-detail__related" aria-label="Related">
        {children}
      </nav>
    </DetailModalSection>
  );
}

export function DetailModalProvenance({ children }) {
  return <p className="dm-detail__provenance page-hint">{children}</p>;
}

export function DetailModalCallout({ children }) {
  return <p className="dm-detail__callout" role="note">{children}</p>;
}
