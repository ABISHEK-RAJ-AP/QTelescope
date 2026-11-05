import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './OpsMonthCalendar.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isoDay(iso) {
  const d = new Date(String(iso || ''));
  if (Number.isNaN(d.getTime())) return String(iso || '').slice(0, 10);
  return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

function buildGrid(year, month) {
  const first = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i += 1) cells.push(null);
  for (let d = 1; d <= count; d += 1) cells.push(d);
  return cells;
}

export function OpsMonthCalendar({ events = [], title = 'Calendar', onOpenEvent }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState(dateKey(today.getFullYear(), today.getMonth(), today.getDate()));

  const byDate = useMemo(() => {
    const acc = {};
    events.forEach((ev) => {
      const key = isoDay(ev.at);
      if (!key) return;
      if (!acc[key]) acc[key] = [];
      acc[key].push(ev);
    });
    return acc;
  }, [events]);

  const grid = useMemo(() => buildGrid(year, month), [year, month]);
  const todayStr = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const monthLabel = `${MONTHS[month]} ${year}`;
  const dayEvents = byDate[selected] || [];

  const prev = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const next = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  return (
    <div className="ops-cal">
      <div className="ops-cal__grid" role="region" aria-label={`${title}, ${monthLabel}`}>
        <div className="ops-cal__header">
          <h3 className="ops-cal__title">{title}</h3>
          <div className="ops-cal__nav">
            <button type="button" className="btn btn-secondary btn--xs" onClick={prev} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <span className="ops-cal__month">{monthLabel}</span>
            <button type="button" className="btn btn-secondary btn--xs" onClick={next} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="ops-cal__weekdays">
          {DAYS.map((d) => <div key={d} className="ops-cal__weekday">{d}</div>)}
        </div>
        <div className="ops-cal__cells" role="grid">
          {grid.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} className="ops-cal__cell ops-cal__cell--empty" aria-hidden />;
            const key = dateKey(year, month, day);
            const list = byDate[key] || [];
            const crit = list.some((e) => e.severity === 'CRITICAL');
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                className={[
                  'ops-cal__cell',
                  key === todayStr && 'is-today',
                  key === selected && 'is-selected',
                  crit && 'is-crit',
                ].filter(Boolean).join(' ')}
                onClick={() => setSelected(key)}
              >
                <span className="ops-cal__day">{day}</span>
                {list.slice(0, 3).map((ev) => (
                  <span key={ev.id} className={`ops-cal__pill ops-cal__pill--${(ev.kind || 'alert').toLowerCase()}`}>
                    {ev.title}
                  </span>
                ))}
                {list.length > 3 ? <span className="ops-cal__more">+{list.length - 3}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      <aside className="ops-cal__side">
        <h4 className="ops-cal__side-title">{selected}</h4>
        <p className="ops-cal__side-hint">Open an item to ack, resolve, or comment by role.</p>
        {dayEvents.length === 0 ? (
          <p className="ops-cal__empty">Nothing recorded this day.</p>
        ) : (
          <ul className="ops-cal__list">
            {dayEvents.map((ev) => (
              <li key={ev.id}>
                <button type="button" className="ops-cal__item" onClick={() => onOpenEvent?.(ev)}>
                  <span className="ops-cal__item-kind">{ev.kind}</span>
                  <span className="ops-cal__item-title">{ev.title}</span>
                  <span className="ops-cal__item-meta">{ev.severity} · {ev.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
