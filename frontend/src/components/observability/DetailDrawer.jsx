import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Centered detail modal (replaces right-side drawer). Export name kept for callers. */
export function DetailDrawer({
  open,
  title,
  subtitle,
  headerAside,
  onClose,
  children,
  footer,
  size = 'md',
  tourId,
}) {
  const closeRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key !== 'Tab' || !panelRef.current) return;
      const nodes = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const panelClass = ['detail-drawer', size === 'lg' ? 'detail-drawer--lg' : '', size === 'xl' ? 'detail-drawer--xl' : ''].filter(Boolean).join(' ');

  return createPortal(
    <div className="detail-drawer-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        className={panelClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-drawer-title"
        data-tour={tourId || undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="detail-drawer__head">
          <div className="detail-drawer__head-row">
            <div className="detail-drawer__titles">
              <h2 id="detail-drawer-title" className="detail-drawer__title">{title}</h2>
              {subtitle ? <p className="detail-drawer__subtitle">{subtitle}</p> : null}
            </div>
            {headerAside ? <div className="detail-drawer__aside">{headerAside}</div> : null}
            <button
              type="button"
              ref={closeRef}
              className="btn btn-secondary detail-drawer__close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="detail-drawer__body">{children}</div>
        {footer ? <footer className="detail-drawer__foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

export { DetailDrawer as DetailModal };
