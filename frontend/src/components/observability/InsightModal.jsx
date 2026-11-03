import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './InsightModal.css';

/** Centered glass modal for qubit / metric drill-down (replaces narrow side drawer). */
export function InsightModal({ open, title, subtitle, onClose, children, footer }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="insight-modal" role="presentation">
      <button type="button" className="insight-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div
        className="insight-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="insight-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="insight-modal__head">
          <div>
            <h2 id="insight-modal-title" className="insight-modal__title">{title}</h2>
            {subtitle && <p className="insight-modal__subtitle">{subtitle}</p>}
          </div>
          <button ref={closeRef} type="button" className="btn btn-secondary btn-icon-only" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="insight-modal__body">{children}</div>
        {footer && <footer className="insight-modal__foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
