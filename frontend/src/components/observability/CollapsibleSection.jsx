import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip.jsx';
import './CollapsibleSection.css';

export function CollapsibleSection({
  id,
  title,
  help = null,
  titleAside = null,
  defaultOpen = true,
  className = '',
  actions = null,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`collapsible-section ${className}`.trim()} aria-labelledby={id}>
      <header className="collapsible-section__head">
        <button
          type="button"
          className="collapsible-section__toggle"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
          <span className="qt-title-with-help collapsible-section__title-cluster">
            <h3 id={id} className="al-h collapsible-section__title">{title}</h3>
            {titleAside || null}
            {help ? <InfoTooltip label={title} align="start">{help}</InfoTooltip> : null}
          </span>
        </button>
        {actions ? <div className="collapsible-section__actions">{actions}</div> : null}
      </header>
      {open ? (
        <div id={`${id}-body`} className="collapsible-section__body">
          {children}
        </div>
      ) : null}
    </section>
  );
}
