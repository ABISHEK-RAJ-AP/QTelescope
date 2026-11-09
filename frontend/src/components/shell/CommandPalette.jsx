import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { canSeeNavItem, canManageFleet } from '@/lib/permissions';
import './commandPalette.css';

const NAV_COMMANDS = [
  { id: 'overview', label: 'Fleet overview', path: '/app/overview', nav: 'home', group: 'Observe' },
  { id: 'operate', label: 'Operator console', path: '/app/operate', nav: 'operations', group: 'Observe' },
  { id: 'platform', label: 'Platform health', path: '/app/platform/health', nav: 'platform', group: 'Observe' },
  { id: 'inventory', label: 'Backend inventory', path: '/app/backends/inventory', nav: 'backends', group: 'Observe' },
  { id: 'live', label: 'Live telemetry', path: '/app/telemetry/live', nav: 'telemetry', group: 'Analyze' },
  { id: 'calibration', label: 'Calibration status', path: '/app/telemetry/calibration', nav: 'telemetry', group: 'Analyze' },
  { id: 'drift', label: 'Drift analysis', path: '/app/telemetry/drift', nav: 'telemetry', group: 'Analyze' },
  { id: 'jobs', label: 'Job monitoring', path: '/app/execution/jobs', nav: 'execution', group: 'Execute' },
  { id: 'queues', label: 'Queue monitoring', path: '/app/execution/queues', nav: 'execution', group: 'Execute' },
  { id: 'alerts', label: 'Active alerts', path: '/app/alerts', nav: 'alerts', group: 'Record' },
  { id: 'incidents', label: 'Open incidents', path: '/app/alerts/incidents', nav: 'alerts', group: 'Record' },
  { id: 'timeline', label: 'Operations timeline', path: '/app/investigate/timeline', nav: 'investigate', group: 'Record' },
  { id: 'reports', label: 'Reports & evidence', path: '/app/reports', nav: 'reports', group: 'Record' },
  { id: 'settings', label: 'Account settings', path: '/app/settings', nav: 'settings', group: 'Personal' },
  { id: 'admin-int', label: 'Integrations', path: '/app/admin/integrations', nav: 'admin', group: 'Configure' },
  { id: 'admin-coll', label: 'Collectors', path: '/app/admin/collectors', nav: 'admin', group: 'Configure' },
  { id: 'admin-rules', label: 'Alert rules', path: '/app/admin/rules', nav: 'admin', group: 'Configure' },
  { id: 'admin-users', label: 'Users & roles', path: '/app/admin/users', nav: 'admin', group: 'Configure' },
];

export function CommandPalette({ open, onClose, currentUser, onStartTour }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const commands = useMemo(() => {
    const base = NAV_COMMANDS.filter((c) => canSeeNavItem(currentUser, c.nav));
    if (canManageFleet(currentUser)) {
      base.push({
        id: 'run-discovery',
        label: 'Platform setup wizard',
        path: '/app/onboarding',
        nav: 'onboarding',
        group: 'Configure',
      });
    }
    if (onStartTour) {
      base.push({
        id: 'tour',
        label: 'Restart product tour',
        action: onStartTour,
        group: 'Personal',
      });
    }
    return base;
  }, [currentUser, onStartTour]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 12);
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const run = useCallback(
    (cmd) => {
      if (cmd.action) cmd.action();
      else if (cmd.path) navigate(cmd.path);
      onClose?.();
    },
    [navigate, onClose],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && filtered[active]) {
        e.preventDefault();
        run(filtered[active]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, active, run, onClose]);

  if (!open) return null;

  return (
    <div className="cmdk-backdrop" role="presentation" onClick={onClose}>
      <div
        className="cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Command search"
        onClick={(e) => e.stopPropagation()}
      >
        <form className="cmdk__search" onSubmit={(e) => { e.preventDefault(); if (filtered[active]) run(filtered[active]); }}>
          <Search size={18} aria-hidden />
          <input
            type="search"
            autoFocus
            placeholder="Search pages and commands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search commands"
          />
          <button type="button" className="cmdk__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </form>
        <ul className="cmdk__list" role="listbox">
          {filtered.length === 0 ? (
            <li className="cmdk__empty">No matches for this search.</li>
          ) : (
            filtered.map((cmd, i) => (
              <li key={cmd.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={`cmdk__item${i === active ? ' is-active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(cmd)}
                >
                  <span className="cmdk__label">{cmd.label}</span>
                  <span className="cmdk__group">{cmd.group}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="cmdk__hint">↑↓ navigate · Enter open · Esc close</p>
      </div>
    </div>
  );
}

/** Register global Ctrl/Cmd+K shortcut. */
export function useCommandPaletteShortcut(onOpen) {
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpen?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen]);
}
