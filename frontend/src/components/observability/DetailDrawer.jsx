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

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
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

  const panelClass = ['detail-drawer', size === 'lg' ? 'detail-drawer--lg' : ''].filter(Boolean).join(' ');

  return createPortal(
    <div className="detail-drawer-backdrop" role="presentation" onClick={onClose}>
      <div
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
          {headerAside ? <div className="detail-drawer__aside">{headerAside}</div> : null}
        </header>
        <div className="detail-drawer__body">{children}</div>
        {footer ? <footer className="detail-drawer__foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

export { DetailDrawer as DetailModal };
