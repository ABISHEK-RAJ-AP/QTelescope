import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { OpsCalendarDayModal } from './OpsCalendarDayModal.jsx';
import './OpsMonthCalendar.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const CELL_PILLS = 3;
const SEV_RANK = { CRITICAL: 0, WARNING: 1, INFO: 2 };

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

function worstSev(items) {
  return [...items].sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9))[0]?.severity;
}

function statusMix(items) {
  const m = {};
  items.forEach((e) => { m[e.status] = (m[e.status] || 0) + 1; });
  return Object.entries(m).map(([k, n]) => `${n} ${String(k).toLowerCase()}`).join(' · ');
}

export function groupCalendarEvents(events) {
  const byDate = {};
  events.forEach((ev) => {
    const day = isoDay(ev.at);
    if (!day) return;
    if (!byDate[day]) byDate[day] = new Map();
    const key = ev.groupKey || `${ev.kind}|${ev.title}`;
    const map = byDate[day];
    if (!map.has(key)) {
      map.set(key, { key, kind: ev.kind, title: ev.title, items: [] });
    }
    map.get(key).items.push(ev);
  });
  const out = {};
  Object.entries(byDate).forEach(([day, map]) => {
    out[day] = [...map.values()].map((g) => ({
      ...g,
      count: g.items.length,
      severity: worstSev(g.items),
      statusLabel: statusMix(g.items),
    })).sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9) || b.count - a.count);
  });
  return out;
}

export function OpsMonthCalendar({
  events = [],
  title = 'Calendar',
  showTitle = true,
  onOpenEvent,
  layout = 'split',
  variant = 'default',
  dayDetailMode = 'modal',
  canAckAlerts = false,
  canResolveAlerts = false,
  onAckAlert,
  onResolveAlert,
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState(dateKey(today.getFullYear(), today.getMonth(), today.getDate()));
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [dayModalKey, setDayModalKey] = useState(null);

  const byDate = useMemo(() => groupCalendarEvents(events), [events]);
  const grid = useMemo(() => buildGrid(year, month), [year, month]);
  const todayStr = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const monthLabel = `${MONTHS[month]} ${year}`;
  const modalGroups = dayModalKey ? (byDate[dayModalKey] || []) : [];

  const prev = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const next = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  const pickDay = (key) => {
    setSelected(key);
    const groups = byDate[key] || [];
  const total = groups.reduce((n, g) => n + g.count, 0);
    if (dayDetailMode === 'modal' && total > 0) {
      setDayModalKey(key);
      setDayModalOpen(true);
    }
  };

  const rootClass = [
    'ops-cal',
    layout === 'stacked' && 'ops-cal--stacked',
    variant === 'full' && 'ops-cal--full',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      <div className="ops-cal__grid" role="region" aria-label={`${title}, ${monthLabel}`}>
        <div className="ops-cal__header">
          {showTitle ? <h3 className="ops-cal__title">{title}</h3> : null}
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
            const groups = byDate[key] || [];
            const total = groups.reduce((n, g) => n + g.count, 0);
            const crit = groups.some((g) => g.severity === 'CRITICAL');
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
                onClick={() => pickDay(key)}
              >
                <span className="ops-cal__day">{day}</span>
                {groups.slice(0, CELL_PILLS).map((g) => (
                  <span key={g.key} className={`ops-cal__pill ops-cal__pill--${(g.kind || 'alert').toLowerCase()}`}>
                    {g.title} · {g.count}
                  </span>
                ))}
                {groups.length > CELL_PILLS
                  ? <span className="ops-cal__more">+{groups.length - CELL_PILLS} more groups · {total} items</span>
                  : total > 0 ? <span className="ops-cal__more">{total} item{total === 1 ? '' : 's'}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      {dayDetailMode === 'modal' && (
        <OpsCalendarDayModal
          open={dayModalOpen}
          dayKey={dayModalKey}
          groups={modalGroups}
          onClose={() => setDayModalOpen(false)}
          onOpenEvent={onOpenEvent}
          canAckAlerts={canAckAlerts}
          canResolveAlerts={canResolveAlerts}
          onAckAlert={onAckAlert}
          onResolveAlert={onResolveAlert}
        />
      )}
    </div>
  );
}
