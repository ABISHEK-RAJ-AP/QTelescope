import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { canSeeNavItem, canManageFleet } from '@/lib/permissions';
import { consoleCommands } from '@/lib/consoleRoutes';
import { buildBackendDetailsPath } from '@/lib/investigationLinks.js';
import { api } from '@/services/api';
import './commandPalette.css';

const matchHay = (q, ...parts) => parts.some((p) => String(p || '').toLowerCase().includes(q));

export function CommandPalette({ open, onClose, currentUser, onStartTour }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [entityHits, setEntityHits] = useState([]);
  const [entityBusy, setEntityBusy] = useState(false);

  const commands = useMemo(() => {
    const base = consoleCommands().filter((c) => canSeeNavItem(currentUser, c.nav));
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

  useEffect(() => {
    if (!open) {
      setEntityHits([]);
      return undefined;
    }
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      setEntityHits([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setEntityBusy(true);
      try {
        const [rawBackends, rawAlerts, rawIncidents, rawJobs, rawColl] = await Promise.all([
          api.getBackends().catch(() => []),
          canSeeNavItem(currentUser, 'alerts') ? api.getAlerts('ACTIVE').catch(() => []) : Promise.resolve([]),
          canSeeNavItem(currentUser, 'alerts') ? api.getIncidents('OPEN').catch(() => []) : Promise.resolve([]),
          canSeeNavItem(currentUser, 'execution') ? api.getJobs().catch(() => []) : Promise.resolve([]),
          canManageFleet(currentUser) ? api.getCollectorHealth().catch(() => ({})) : Promise.resolve({}),
        ]);
        const backends = Array.isArray(rawBackends) ? rawBackends : (rawBackends?.items || rawBackends?.backends || []);
        const alerts = Array.isArray(rawAlerts) ? rawAlerts : (rawAlerts?.alerts || rawAlerts?.items || []);
        const incidents = Array.isArray(rawIncidents) ? rawIncidents : (rawIncidents?.incidents || rawIncidents?.items || []);
        const hits = [];
        backends.forEach((b) => {
          const id = b.backend_id || b.id;
          if (!id || !matchHay(q, id, b.name, b.provider_id)) return;
          hits.push({
            id: `be-${id}`,
            label: `Backend ${b.name || id}`,
            path: buildBackendDetailsPath(id),
            group: 'Backend',
          });
        });
        alerts.slice(0, 40).forEach((a) => {
          const id = a.alert_id || a.id;
          if (!id || !matchHay(q, id, a.rule_id, a.backend_id, a.message)) return;
          hits.push({
            id: `al-${id}`,
            label: `Alert ${id}`,
            path: `/app/alerts/detail/${encodeURIComponent(id)}`,
            group: 'Alert',
          });
        });
        incidents.slice(0, 40).forEach((inc) => {
          const id = inc.incident_id || inc.id;
          if (!id || !matchHay(q, id, inc.title, inc.summary)) return;
          hits.push({
            id: `in-${id}`,
            label: `Incident ${inc.title || id}`,
            path: `/app/alerts/incidents/${encodeURIComponent(id)}`,
            group: 'Incident',
          });
        });
        const jobs = Array.isArray(rawJobs) ? rawJobs : (rawJobs?.jobs || []);
        jobs.slice(0, 30).forEach((j) => {
          const id = j.job_id || j.id;
          if (!id || !matchHay(q, id, j.backend_id, j.status)) return;
          hits.push({
            id: `job-${id}`,
            label: `Job ${id}`,
            path: '/app/execution/jobs',
            group: 'Job',
          });
        });
        const providers = rawColl?.providers || [];
        providers.forEach((p) => {
          const id = p.provider_id;
          if (!id || !matchHay(q, id, p.status)) return;
          hits.push({
            id: `col-${id}`,
            label: `Collector ${id}`,
            path: '/app/admin/collectors',
            group: 'Collector',
          });
        });
        if (!cancelled) setEntityHits(hits.slice(0, 18));
      } catch {
        if (!cancelled) setEntityHits([]);
      } finally {
        if (!cancelled) setEntityBusy(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, currentUser]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const navHits = q
      ? commands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q))
      : commands.slice(0, 12);
    if (q.length >= 2 && entityHits.length) {
      const navFiltered = navHits.filter((c) => !entityHits.some((e) => e.path === c.path));
      return [...entityHits, ...navFiltered].slice(0, 20);
    }
    return navHits;
  }, [commands, query, entityHits]);

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
            placeholder="Search pages, backends, alerts, incidents…"
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
            <li className="cmdk__empty">{entityBusy ? 'Searching…' : 'No matches for this search.'}</li>
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
