import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ListPager } from './ListPager.jsx';
import './OpsMonthCalendar.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const CELL_PILLS = 3;
const GROUP_PAGE = 8;
const MEMBER_PAGE = 12;
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

export function OpsMonthCalendar({ events = [], title = 'Calendar', onOpenEvent }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState(dateKey(today.getFullYear(), today.getMonth(), today.getDate()));
  const [openKey, setOpenKey] = useState(null);
  const [groupPage, setGroupPage] = useState(1);
  const [memberPage, setMemberPage] = useState(1);

  const byDate = useMemo(() => groupCalendarEvents(events), [events]);
  const grid = useMemo(() => buildGrid(year, month), [year, month]);
  const todayStr = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const monthLabel = `${MONTHS[month]} ${year}`;
  const dayGroups = byDate[selected] || [];
  const dayCount = dayGroups.reduce((n, g) => n + g.count, 0);

  useEffect(() => {
    setOpenKey(null);
    setGroupPage(1);
    setMemberPage(1);
  }, [selected]);

  const groupPages = Math.max(1, Math.ceil(dayGroups.length / GROUP_PAGE));
  const gPage = Math.min(groupPage, groupPages);
  const shownGroups = dayGroups.slice((gPage - 1) * GROUP_PAGE, gPage * GROUP_PAGE);
  const openGroup = dayGroups.find((g) => g.key === openKey);
  const members = openGroup?.items || [];
  const memberPages = Math.max(1, Math.ceil(members.length / MEMBER_PAGE));
  const mPage = Math.min(memberPage, memberPages);
  const shownMembers = members.slice((mPage - 1) * MEMBER_PAGE, mPage * MEMBER_PAGE);

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
  };

  const pickGroup = (g) => {
    if (g.count === 1) {
      onOpenEvent?.(g.items[0]);
      return;
    }
    setOpenKey((k) => (k === g.key ? null : g.key));
    setMemberPage(1);
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
      <aside className="ops-cal__side">
        <h4 className="ops-cal__side-title">{selected}</h4>
        <p className="ops-cal__side-hint">
          {dayCount === 0
            ? 'Nothing recorded this day.'
            : `${dayGroups.length} group${dayGroups.length === 1 ? '' : 's'} · ${dayCount} item${dayCount === 1 ? '' : 's'}. Open a group, then a row.`}
        </p>
        {dayGroups.length === 0 ? null : (
          <>
            <ul className="ops-cal__list">
              {shownGroups.map((g) => (
                <li key={g.key}>
                  <button type="button" className={`ops-cal__item ${openKey === g.key ? 'is-open' : ''}`} onClick={() => pickGroup(g)}>
                    <span className="ops-cal__item-kind">{g.kind}</span>
                    <span className="ops-cal__item-title">{g.title}</span>
                    <span className="ops-cal__item-meta">{g.count} · {g.severity} · {g.statusLabel}</span>
                  </button>
                </li>
              ))}
            </ul>
            <ListPager page={gPage} pages={groupPages} onPage={setGroupPage} />
            {openGroup && openGroup.count > 1 && (
              <div className="ops-cal__members">
                <p className="ops-cal__members-h">{openGroup.title}</p>
                <ul className="ops-cal__list">
                  {shownMembers.map((ev) => (
                    <li key={ev.id}>
                      <button type="button" className="ops-cal__item ops-cal__item--sub" onClick={() => onOpenEvent?.(ev)}>
                        <span className="ops-cal__item-title">{ev.subtitle || ev.id}</span>
                        <span className="ops-cal__item-meta">{ev.severity} · {ev.status}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <ListPager page={mPage} pages={memberPages} onPage={setMemberPage} />
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
