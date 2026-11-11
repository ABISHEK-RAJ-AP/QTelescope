import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ListPager } from './ListPager.jsx';

const EVENT_PAGE = 20;
const SEV_RANK = { CRITICAL: 0, WARNING: 1, INFO: 2 };

function eventLabel(ev) {
  return ev.title || ev.subtitle || ev.id;
}

function formatDayKey(dayKey) {
  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return dayKey || 'Day';
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return dayKey;
  return dt.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function isAlertEv(ev) {
  const k = String(ev.groupKind || ev.kind || '').toLowerCase();
  return k === 'alert';
}

export function OpsCalendarDayModal({
  open,
  dayKey,
  groups = [],
  onClose,
  onOpenEvent,
  canAckAlerts = false,
  canResolveAlerts = false,
  onAckAlert,
  onResolveAlert,
}) {
  const flatEvents = useMemo(() => {
    const rows = groups.flatMap((g) => g.items.map((ev) => ({
      ...ev,
      groupTitle: g.title,
      groupKind: g.kind || ev.kind,
    })));
    return rows.sort(
      (a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9)
        || String(a.at || '').localeCompare(String(b.at || '')),
    );
  }, [groups]);

  const [page, setPage] = React.useState(1);
  const pages = Math.max(1, Math.ceil(flatEvents.length / EVENT_PAGE));
  const cur = Math.min(page, pages);
  const shown = flatEvents.slice((cur - 1) * EVENT_PAGE, cur * EVENT_PAGE);

  useEffect(() => {
    if (!open) return undefined;
    setPage(1);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, dayKey, onClose]);

  const openOne = (ev) => {
    onClose();
    if (typeof ev.open === 'function') {
      ev.open();
      return;
    }
    onOpenEvent?.(ev);
  };

  const viewLabel = (ev) => {
    const k = String(ev.groupKind || ev.kind || '').toLowerCase();
    if (k === 'incident') return 'View incident';
    return 'View alert';
  };

  if (!open) return null;

  const dayCount = flatEvents.length;
  const dayTitle = formatDayKey(dayKey);

  const dialog = (
    <div className="ops-cal-day-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="ops-cal-day-modal"
        role="dialog"
        aria-modal="true"
        aria-label={dayTitle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ops-cal-day-modal__header">
          <div>
            <h2 className="ops-cal-day-modal__title">{dayTitle}</h2>
            <p className="ops-cal__side-hint" style={{ margin: '4px 0 0' }}>
              {dayCount === 0
                ? 'Nothing recorded this day.'
                : `${dayCount} event${dayCount === 1 ? '' : 's'}`}
            </p>
          </div>
          <button type="button" className="ops-cal-day-modal__close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="ops-cal-day-modal__body">
          {flatEvents.length === 0 ? (
            <p className="page-hint">No alerts or incidents on this day.</p>
          ) : (
            <>
              <ul className="ops-cal__list ops-cal-day-events">
                {shown.map((ev) => {
                  const alert = isAlertEv(ev);
                  const showAck = alert && ev.status === 'ACTIVE' && canAckAlerts && typeof onAckAlert === 'function';
                  const showResolve = alert && ev.status !== 'RESOLVED' && canResolveAlerts && typeof onResolveAlert === 'function';
                  return (
                    <li key={`${ev.kind || 'ev'}-${ev.id}`} className="ops-cal-day-event">
                      <div className="ops-cal-day-event__main">
                        <span className="ops-cal__item-kind">{ev.groupKind || ev.kind || 'Event'}</span>
                        <span className="ops-cal-day-event__title">{eventLabel(ev)}</span>
                        {ev.groupTitle && ev.groupTitle !== eventLabel(ev) ? (
                          <span className="ops-cal-day-event__group">{ev.groupTitle}</span>
                        ) : null}
                        <span className="ops-cal__item-meta">
                          {ev.severity || '—'}{ev.status ? ` · ${ev.status}` : ''}{ev.subtitle && ev.subtitle !== ev.id ? ` · ${ev.subtitle}` : ''}
                        </span>
                      </div>
                      <div className="ops-cal-day-event__actions">
                        <button type="button" className="btn btn-primary btn--xs" onClick={() => openOne(ev)}>
                          {viewLabel(ev)}
                        </button>
                        {showAck ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn--xs"
                            onClick={() => { onClose(); onAckAlert(ev); }}
                          >
                            Ack
                          </button>
                        ) : null}
                        {showResolve ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn--xs"
                            onClick={() => { onClose(); onResolveAlert(ev); }}
                          >
                            Resolve
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <ListPager page={cur} pages={pages} onPage={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
