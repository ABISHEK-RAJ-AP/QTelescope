import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/** Presentation-size chart overlay (shared across ChartPanel). */
export function ChartExpandModal({ title, question, onClose, children }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('chart-expand-open');
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove('chart-expand-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 80);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="chart-expand" role="presentation">
      <button type="button" className="chart-expand__backdrop" aria-label="Close expanded chart" onClick={onClose} />
      <div
        ref={panelRef}
        className="chart-expand__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="chart-expand__head">
          <div>
            {title && <h2 id={titleId} className="chart-expand__title">{title}</h2>}
            {question && <p className="chart-expand__question">{question}</p>}
          </div>
          <button ref={closeRef} type="button" className="btn btn-secondary btn-icon-only chart-expand__close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="chart-expand__body">
          {children}
        </div>
      </div>
    </div>
  );
}
