import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { OpsMonthCalendar } from './OpsMonthCalendar.jsx';

/** Full-screen calendar — day detail stacks under the grid (no narrow right rail). */
export function OpsCalendarModal({ open, onClose, title, events, onOpenEvent }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="admin-modal-backdrop ops-cal-modal-backdrop" onClick={onClose}>
      <div
        className="admin-modal-card ops-cal-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <div className="admin-modal-title">{title}</div>
          <button type="button" className="admin-modal-close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="admin-modal-body ops-cal-modal__body">
          <OpsMonthCalendar layout="stacked" variant="full" title={title} events={events} onOpenEvent={onOpenEvent} />
        </div>
      </div>
    </div>
  );
}
