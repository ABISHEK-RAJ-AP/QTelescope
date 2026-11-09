import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  Radar,
  RefreshCw,
  X,
  Zap,
  Key,
} from 'lucide-react';
import { markOnboardingPending, getOnboardingRecord } from '@/lib/onboardingState';
import { isPlatformAdmin } from '@/lib/permissions.js';
import { api } from '@/services/api';
import './qt-quick-dock.css';

const DOCK_STORAGE_KEY = 'qts_quick_dock_expanded';

function readExpanded() {
  try {
    return localStorage.getItem(DOCK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeExpanded(v) {
  try {
    localStorage.setItem(DOCK_STORAGE_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function formatBadge(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '';
  if (v > 99) return '99+';
  return String(v);
}

export function QtQuickActionDock({
  currentUser,
  onStartTour,
  activeAlertsCount = 0,
  criticalAlertsCount = 0,
}) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [expanded, setExpanded] = useState(readExpanded);
  const [tourPanelOpen, setTourPanelOpen] = useState(false);
  const [discoverBusy, setDiscoverBusy] = useState(false);

  const isAdmin = isPlatformAdmin(currentUser) || currentUser?.role === 'QuantumOpsAdmin';
  const username = currentUser?.username;
  const onboardingRec = getOnboardingRecord(username);
  const tourSpotlight = onboardingRec?.status === 'completed' && !sessionStorage.getItem('qts_tour_dock_nudge');

  useEffect(() => {
    if (tourSpotlight) sessionStorage.setItem('qts_tour_dock_nudge', '1');
  }, [tourSpotlight]);

  useEffect(() => {
    if (!tourPanelOpen) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setTourPanelOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [tourPanelOpen]);

  const forceCollapsed = tourPanelOpen;
  const showActions = expanded && !forceCollapsed;

  const toggleExpanded = () => {
    setExpanded((v) => {
      const next = !v;
      writeExpanded(next);
      if (!next) setTourPanelOpen(false);
      return next;
    });
  };

  const actions = useMemo(() => {
    const list = [];

    if (criticalAlertsCount > 0) {
      list.push({
        id: 'alerts-urgent',
        label: 'Critical alerts',
        subtitle: `${criticalAlertsCount} need attention`,
        icon: <AlertTriangle size={22} strokeWidth={2} />,
        tone: 'warning',
        className: 'quick-action-spotlight',
        badge: criticalAlertsCount,
        onClick: () => navigate('/app/alerts'),
      });
    }

    list.push(
      {
        id: 'tours',
        label: 'Guided tour',
        subtitle: 'Sidebar and shortcuts',
        icon: <HelpCircle size={22} strokeWidth={2} />,
        tone: 'success',
        className: tourSpotlight ? 'quick-action-spotlight' : undefined,
        onClick: () => {
          setTourPanelOpen(true);
          setExpanded(true);
          writeExpanded(true);
        },
      },
      {
        id: 'setup',
        label: 'Platform setup',
        subtitle: 'Credentials & data map',
        icon: <ListChecks size={22} strokeWidth={2} />,
        tone: 'primary',
        onClick: () => {
          if (username) markOnboardingPending(username);
          navigate('/app/onboarding');
        },
      },
      {
        id: 'overview',
        label: 'Fleet overview',
        subtitle: 'Dashboard & KPIs',
        icon: <LayoutDashboard size={22} strokeWidth={2} />,
        onClick: () => navigate('/app/overview'),
      },
      {
        id: 'operate',
        label: 'Operator console',
        subtitle: 'Incidents & collectors',
        icon: <Radar size={22} strokeWidth={2} />,
        onClick: () => navigate('/app/operate'),
      },
      {
        id: 'telemetry',
        label: 'Live telemetry',
        subtitle: 'SSE qubit stream',
        icon: <Activity size={22} strokeWidth={2} />,
        onClick: () => navigate('/app/telemetry/live'),
      },
    );

    if (activeAlertsCount > 0 && criticalAlertsCount === 0) {
      list.push({
        id: 'alerts',
        label: 'Active alerts',
        subtitle: `${activeAlertsCount} open`,
        icon: <AlertTriangle size={22} strokeWidth={2} />,
        tone: 'warning',
        badge: activeAlertsCount,
        onClick: () => navigate('/app/alerts'),
      });
    }

    if (isAdmin) {
      list.push(
        {
          id: 'integrations',
          label: 'Integrations',
          subtitle: 'Provider credentials',
          icon: <Key size={22} strokeWidth={2} />,
          onClick: () => navigate('/app/admin/integrations'),
        },
        {
          id: 'discover',
          label: 'Auto-discover',
          subtitle: discoverBusy ? 'Scanning…' : 'Refresh QPU catalog',
          icon: <RefreshCw size={22} strokeWidth={2} className={discoverBusy ? 'animate-spin' : ''} />,
          onClick: () => {
            if (discoverBusy) return;
            setDiscoverBusy(true);
            api.triggerAutoDiscovery()
              .catch(() => {})
              .finally(() => setDiscoverBusy(false));
          },
        },
      );
    }

    return list;
  }, [
    navigate,
    username,
    isAdmin,
    activeAlertsCount,
    criticalAlertsCount,
    tourSpotlight,
    discoverBusy,
  ]);

  const startConsoleTour = () => {
    setTourPanelOpen(false);
    setExpanded(false);
    writeExpanded(false);
    onStartTour?.();
  };

  return (
    <div className="qts-quick-dock-root" ref={rootRef}>
      {tourPanelOpen ? (
        <div className="qts-quick-dock__panel" role="dialog" aria-label="Guided tours">
          <header className="qts-quick-dock__panel-head">
            <span>Guided tours</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTourPanelOpen(false)} aria-label="Close">
              <X size={16} />
            </button>
          </header>
          <ul className="qts-quick-dock__tour-list">
            <li className="qts-quick-dock__tour-item">
              <div>
                <strong>Console sidebar tour</strong>
                <span>~2 min · overview, telemetry, alerts</span>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={startConsoleTour}>
                Start
              </button>
            </li>
            <li className="qts-quick-dock__tour-item">
              <div>
                <strong>Platform setup</strong>
                <span>Credentials & capability map</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (username) markOnboardingPending(username);
                  navigate('/app/onboarding');
                }}
              >
                Open
              </button>
            </li>
          </ul>
        </div>
      ) : null}

      <div className={`qts-quick-dock ceg-admin-dock qts-quick-dock--glass${showActions ? ' ceg-admin-dock--expanded' : ''}`}>
        <div className={`ceg-admin-dock__actions${showActions ? ' ceg-admin-dock__actions--open' : ''}`} aria-hidden={!showActions}>
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={`ceg-admin-dock__action${action.tone ? ` ceg-admin-dock__action--${action.tone}` : ''}${action.className ? ` ${action.className}` : ''}`}
              onClick={() => {
                action.onClick?.();
                if (action.id !== 'tours') {
                  setExpanded(false);
                  writeExpanded(false);
                }
              }}
            >
              <span className="ceg-admin-dock__action-icon">
                {action.icon}
                {action.badge ? (
                  <span className="qts-quick-dock__badge" aria-hidden>
                    {formatBadge(action.badge)}
                  </span>
                ) : null}
              </span>
              <span className="ceg-admin-dock__label-wrap">
                <span className="ceg-admin-dock__label">{action.label}</span>
                {action.subtitle ? (
                  <span className="ceg-admin-dock__subtitle">{action.subtitle}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ceg-admin-dock__toggle"
          data-tour="quick-actions-dock"
          aria-expanded={showActions}
          aria-label={
            criticalAlertsCount > 0
              ? `Shortcuts, ${criticalAlertsCount} critical alerts`
              : 'Shortcuts'
          }
          onClick={toggleExpanded}
        >
          {!showActions && criticalAlertsCount > 0 ? (
            <span className="qts-quick-dock__toggle-badge">{formatBadge(criticalAlertsCount)}</span>
          ) : null}
          {showActions ? <X size={22} strokeWidth={2} /> : <Zap size={22} strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}
