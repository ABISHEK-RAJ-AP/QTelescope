import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, Search, Check, Eye } from 'lucide-react';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { api, fetchApi } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { TableEmpty } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { DetailDrawer } from '../components/observability/DetailDrawer.jsx';
import { ConfirmDialog } from '../components/observability/ConfirmDialog.jsx';
export { ConfirmDialog } from '../components/observability/ConfirmDialog.jsx';
import {
  DetailModalBody,
  DetailModalSection,
  DetailModalDl,
  DetailModalRow,
  DetailModalRelated,
  DetailModalHero,
} from '../components/observability/DetailModalLayout.jsx';
import { useAppScope } from '../hooks/useAppScope.js';
import { buildBackendDetailsPath, buildDriftInvestigationLocation } from '../lib/investigationLinks.js';
import { formatIST } from '../utils/time';
import { SevBadge, StatusBadge } from './opsShared.jsx';
import { sevRank, toMs, timelineTo, healthTo, qubitOf } from './opsHelpers.js';
import { notifyError, notifySuccess } from '../lib/toast.js';
import { usePermissions } from '../hooks/usePermissions.js';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { parseIncidentTitle, formatDurationMs } from '../lib/incidentUi.js';
import { ViewModeToggle } from '../components/observability/DataViewToolbar.jsx';
import { OpsMonthCalendar } from '../components/observability/OpsMonthCalendar.jsx';
import { ListPager } from '../components/observability/ListPager.jsx';
import { CollapsibleSection } from '../components/observability/CollapsibleSection.jsx';
import { DiscussionModal } from '../components/observability/DiscussionModal.jsx';
import './AlertsEvents.css';

const FETCH_LIMIT = 500; // API max for /alerts
const PAGE_SIZE = 20;
const CHILD_PAGE = 12;
const SEVERITIES = ['CRITICAL', 'WARNING', 'INFO'];
const STATUSES = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'];
const num = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(1));

function groupAlerts(alerts, grouped) {
  const map = new Map();
  alerts.forEach((a) => {
    const key = grouped ? `${a.backend_id}|${a.alert_type}` : a.alert_id;
    if (!map.has(key)) map.set(key, { key, backend: a.backend_id, type: a.alert_type, items: [] });
    map.get(key).items.push(a);
  });
  return [...map.values()].map((g) => {
    const sev = {}; const st = {};
    g.items.forEach((a) => { sev[a.severity] = (sev[a.severity] || 0) + 1; st[a.status] = (st[a.status] || 0) + 1; });
    const vals = g.items.map((a) => a.current_value).filter((v) => v != null);
    const times = g.items.map((a) => toMs(a.detected_at)).filter((t) => t != null);
    return {
      ...g, sev, st, count: g.items.length,
      worst: [...g.items].sort((a, b) => sevRank(a.severity) - sevRank(b.severity))[0].severity,
      latest: Math.max(...times), first: Math.min(...times),
      latestIso: g.items.find((a) => toMs(a.detected_at) === Math.max(...times))?.detected_at,
      lo: vals.length ? Math.min(...vals) : null, hi: vals.length ? Math.max(...vals) : null,
      threshold: g.items[0].threshold_value,
      open: g.items.filter((a) => a.status === 'ACTIVE'),
      unresolved: g.items.filter((a) => a.status !== 'RESOLVED'),
    };
  });
}

const SORTS = {
  severity: (a, b) => sevRank(a.worst) - sevRank(b.worst) || b.count - a.count,
  count: (a, b) => a.count - b.count,
  backend: (a, b) => String(a.backend).localeCompare(String(b.backend)),
  type: (a, b) => String(a.type).localeCompare(String(b.type)),
  latest: (a, b) => a.latest - b.latest,
};

function Breakdown({ counts, order }) {
  return (
    <span className="al-breakdown">
      {order.filter((k) => counts[k]).map((k) => <span key={k}><b>{counts[k]}</b> {k.toLowerCase()}</span>)}
    </span>
  );
}

export const AlertsEvents = ({ view = 'alerts', onViewChange, onOpenIncident, onOpenAlert, currentUser }) => {
  const nav = useNavigate();
  const perms = usePermissions(currentUser);
  const { backend: scopeBackend, alertId: scopeAlert, setBackend, setAlertId } = useAppScope();
  const { setActions, clearActions } = usePageActions();
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const [sevF, setSevF] = useState('ALL');
  const [statusF, setStatusF] = useState('ACTIVE');
  const [query, setQuery] = useState('');
  const [grouped, setGrouped] = useState(true);
  const [sort, setSort] = useState({ key: 'severity', dir: 'asc' });
  const [expanded, setExpanded] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [childPage, setChildPage] = useState({});
  const [incPage, setIncPage] = useState(1);
  const [drawerId, setDrawerId] = useState(null);
  const [incDrawerId, setIncDrawerId] = useState(null);
  const stopRow = (e) => e.stopPropagation();
  const openAlert = useCallback((id) => {
    if (onOpenAlert) onOpenAlert(id);
    else setDrawerId(id);
  }, [onOpenAlert]);
  const openIncident = useCallback((id) => {
    if (onOpenIncident) onOpenIncident(id);
    else setIncDrawerId(id);
  }, [onOpenIncident]);
  const [dlg, setDlg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [incCommentBusy, setIncCommentBusy] = useState(false);
  const [listLayout, setListLayout] = useState('table');
  const [incLayout, setIncLayout] = useState('grid');
  const [alertDetail, setAlertDetail] = useState(null);
  const [alertCommentBusy, setAlertCommentBusy] = useState(false);
  const [alertDiscOpen, setAlertDiscOpen] = useState(false);
  const [incDiscOpen, setIncDiscOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, i] = await Promise.all([
        fetchApi(`/alerts?limit=${FETCH_LIMIT}`),
        api.getIncidents().catch(() => null),
      ]);
      setAlerts(a || []);
      setIncidents(i || []);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh alerts" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);
  useEffect(() => { setPage(1); setChildPage({}); }, [sevF, statusF, query, scopeBackend, grouped]);
  useEffect(() => {
    if (view !== 'alerts') {
      setDrawerId(null);
      return;
    }
    if (scopeAlert) {
      if (onOpenAlert) onOpenAlert(scopeAlert);
      else setDrawerId(scopeAlert);
    }
  }, [scopeAlert, onOpenAlert, view]);
  useEffect(() => {
    if (error && (alerts.length || incidents.length)) {
      notifyError(`Last refresh failed: ${error}`, { toastId: 'alerts-load' });
    }
  }, [error, alerts.length, incidents.length]);

  const backends = useMemo(() => [...new Set(alerts.map((a) => a.backend_id).filter(Boolean))].sort(), [alerts]);

  // ---- counts (source of truth: full /alerts list) ----
  const stats = useMemo(() => {
    const m = {};
    alerts.forEach((a) => { m[`${a.severity}|${a.status}`] = (m[`${a.severity}|${a.status}`] || 0) + 1; });
    const active = alerts.filter((a) => a.status === 'ACTIVE');
    const byBackend = {};
    active.forEach((a) => {
      const b = byBackend[a.backend_id] || (byBackend[a.backend_id] = { id: a.backend_id, CRITICAL: 0, WARNING: 0, INFO: 0, total: 0 });
      b[a.severity] = (b[a.severity] || 0) + 1; b.total += 1;
    });
    return { m, active: active.length, byBackend: Object.values(byBackend).sort((a, b) => b.total - a.total) };
  }, [alerts]);

  const critActive = useMemo(
    () => alerts.filter((a) => a.status === 'ACTIVE' && a.severity === 'CRITICAL').length,
    [alerts],
  );

  const trendOption = useMemo(() => {
    const hours = 24;
    const now = Date.now();
    const labels = [];
    const crit = [];
    const warn = [];
    for (let i = hours - 1; i >= 0; i -= 1) {
      const end = now - i * 3600000;
      const start = end - 3600000;
      const d = new Date(end);
      labels.push(`${String(d.getHours()).padStart(2, '0')}:00`);
      let c = 0;
      let w = 0;
      alerts.forEach((a) => {
        const t = toMs(a.detected_at);
        if (t == null || t < start || t >= end) return;
        if (a.severity === 'CRITICAL') c += 1;
        else if (a.severity === 'WARNING') w += 1;
      });
      crit.push(c);
      warn.push(w);
    }
    return {
      grid: { left: 48, right: 16, top: 32, bottom: 28 },
      tooltip: { trigger: 'axis' },
      legend: { data: ['Critical', 'Warning'], top: 0, textStyle: { fontSize: 11 } },
      xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10, interval: 3 } },
      yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 10 } },
      series: [
        { name: 'Critical', type: 'bar', stack: 'alerts', data: crit, itemStyle: { color: '#f43f5e' } },
        { name: 'Warning', type: 'bar', stack: 'alerts', data: warn, itemStyle: { color: '#f59e0b' } },
      ],
    };
  }, [alerts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts.filter((a) => (
      (sevF === 'ALL' || a.severity === sevF)
      && (statusF === 'ALL' || a.status === statusF)
      && (!scopeBackend || a.backend_id === scopeBackend)
      && (!q || [a.alert_id, a.message, a.alert_type, a.backend_id, a.resource_id].some((f) => String(f || '').toLowerCase().includes(q)))
    ));
  }, [alerts, sevF, statusF, scopeBackend, query]);

  const rows = useMemo(() => {
    const cmp = SORTS[sort.key];
    const r = groupAlerts(filtered, grouped).sort(cmp);
    return sort.dir === 'desc' ? r.reverse() : r;
  }, [filtered, grouped, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const curPage = Math.min(page, pages);
  const pageRows = rows.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  const alertById = useMemo(() => new Map(alerts.map((a) => [a.alert_id, a])), [alerts]);
  const drawerAlert = drawerId ? alertById.get(drawerId) : null;

  useEffect(() => {
    if (!drawerId) {
      setAlertDetail(null);
      setAlertDiscOpen(false);
      return undefined;
    }
    let cancelled = false;
    api.getAlert(drawerId).then((d) => { if (!cancelled) setAlertDetail(d); }).catch(() => {
      if (!cancelled) setAlertDetail(null);
    });
    return () => { cancelled = true; };
  }, [drawerId]);

  const calEvents = useMemo(() => {
    const alertEv = filtered.map((a) => ({
      id: a.alert_id,
      at: a.detected_at,
      title: `${a.backend_id} ${a.alert_type}`,
      subtitle: qubitOf(a) || a.alert_id,
      groupKey: `alert|${a.backend_id}|${a.alert_type}`,
      kind: 'Alert',
      severity: a.severity,
      status: a.status,
      open: () => openAlert(a.alert_id),
    }));
    const incEv = incidents.map((inc) => ({
      id: inc.incident_id,
      at: inc.first_detected_at || inc.created_at,
      title: inc.title || inc.incident_id,
      subtitle: inc.incident_id,
      groupKey: `incident|${inc.incident_id}`,
      kind: 'Incident',
      severity: inc.severity,
      status: inc.status,
      open: () => openIncident(inc.incident_id),
    }));
    return view === 'incidents' ? incEv : [...alertEv, ...incEv];
  }, [filtered, incidents, view, openAlert, openIncident]);
  const relatedIncident = (a) => incidents.find((i) => i.backend_id === a.backend_id && String(i.title).endsWith(a.alert_type));

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'count' || key === 'latest' ? 'desc' : 'asc' }));
  const sortTh = (k, children) => (
    <th key={k} aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="al-sort" onClick={() => toggleSort(k)}>
        {children}{sort.key === k && (sort.dir === 'asc' ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
      </button>
    </th>
  );

  // ---- actions ----
  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const res = await fn();
      notifySuccess(typeof okMsg === 'function' ? okMsg(res) : okMsg);
      await load();
    } catch (e) {
      notifyError(e?.message || String(e));
    } finally {
      setBusy(false);
      setDlg(null);
    }
  };

  const actorName = currentUser?.username || currentUser?.full_name || 'operator';

  const bulk = (verb, items) => {
    const isAck = verb === 'acknowledge';
    setDlg({
      title: `${isAck ? 'Acknowledge' : 'Resolve'} ${items.length} alert${items.length === 1 ? '' : 's'}?`,
      body: isAck
        ? 'Marks them ACKNOWLEDGED under your name. They stay open until the condition clears.'
        : 'Marks them RESOLVED. Alerts may re-fire on the next collection cycle if still out of threshold.',
      confirm: isAck ? 'Acknowledge' : 'Resolve',
      danger: !isAck,
      input: 'Comment (optional)',
      defaultText: '',
      required: false,
      onConfirm: (text) => run(async () => {
        const comment = (text || '').trim();
        const res = await Promise.allSettled(items.map((a) => (
          isAck
            ? api.acknowledgeAlert(a.alert_id, { acknowledged_by: actorName, comment: comment || undefined })
            : api.resolveAlert(a.alert_id, comment)
        )));
        const failed = res.filter((r) => r.status === 'rejected');
        if (failed.length === res.length) throw new Error(failed[0].reason?.message || 'All requests failed');
        return { ok: res.length - failed.length, failed: failed.length };
      }, (r) => `${isAck ? 'Acknowledged' : 'Resolved'} ${r.ok} alert(s)${r.failed ? `; ${r.failed} failed` : ''}.`),
    });
  };

  const incAction = (inc, kind) => {
    const cfg = {
      acknowledge: {
        title: 'Acknowledge incident?',
        body: inc.title,
        confirm: 'Acknowledge',
        input: 'Comment (optional)',
        defaultText: '',
        required: false,
        fn: (t) => api.acknowledgeIncident(inc.incident_id, {
          acknowledged_by: actorName,
          comment: (t || '').trim() || undefined,
        }),
        ok: 'Incident acknowledged.',
      },
      investigate: { title: 'Start investigating?', body: inc.title, confirm: 'Investigate', fn: () => api.investigateIncident(inc.incident_id), ok: 'Incident moved to INVESTIGATING.' },
      resolve: {
        title: 'Resolve incident?',
        body: `${inc.title} — closes the incident record. Linked alerts are not auto-resolved.`,
        confirm: 'Resolve',
        danger: true,
        input: 'Resolution notes (optional)',
        defaultText: '',
        required: false,
        fn: (t) => api.resolveIncident(inc.incident_id, t),
        ok: 'Incident resolved.',
      },
      comment: { title: 'Add comment', body: inc.title, confirm: 'Post comment', input: 'Comment', required: true, fn: (t) => api.addIncidentComment(inc.incident_id, t.trim()), ok: 'Comment added.' },
    }[kind];
    setDlg({ ...cfg, onConfirm: (t) => run(() => cfg.fn(t), cfg.ok) });
  };

  const openBackend = (id) => nav(buildBackendDetailsPath(id, 'qubits'));
  const clearFilters = () => { setSevF('ALL'); setStatusF('ALL'); setQuery(''); setBackend(''); };
  const toggleExpand = (k) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    return n;
  });
  const incPages = Math.max(1, Math.ceil(incidents.length / PAGE_SIZE));
  const incCur = Math.min(incPage, incPages);
  const incRows = incidents.slice((incCur - 1) * PAGE_SIZE, incCur * PAGE_SIZE);
  const closeDrawer = useCallback(() => { setDrawerId(null); if (scopeAlert) setAlertId(''); }, [scopeAlert, setAlertId]);

  if (loading) return <BoneyardSkeleton layout="table" />;
  if (error && !alerts.length && !incidents.length) return <ErrorState message={error} onRetry={load} />;

  const sevTotal = (s) => STATUSES.reduce((n, st) => n + (stats.m[`${s}|${st}`] || 0), 0);
  const openIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const openCritInc = openIncidents.filter((i) => i.severity === 'CRITICAL').length;
  const unassignedInc = openIncidents.filter((i) => !i.owner && !i.acknowledged_by).length;

  const rowActions = (a) => (
    <>
      {a.status === 'ACTIVE' && perms.canAckAlerts && (
        <button type="button" className="btn btn-secondary btn--xs" onClick={() => bulk('acknowledge', [a])}>Ack</button>
      )}
      {a.status !== 'RESOLVED' && perms.canResolveAlerts && (
        <button type="button" className="btn btn-secondary btn--xs" onClick={() => bulk('resolve', [a])}>Resolve</button>
      )}
    </>
  );

  const incActions = (inc) => (
    <>
      {inc.status === 'OPEN' && perms.canManageIncidents && (
        <button type="button" className="btn btn-secondary btn--xs" onClick={() => incAction(inc, 'acknowledge')}>Ack</button>
      )}
      {inc.status === 'ACKNOWLEDGED' && perms.canManageIncidents && (
        <button type="button" className="btn btn-secondary btn--xs" onClick={() => incAction(inc, 'investigate')}>Investigate</button>
      )}
      {inc.status !== 'RESOLVED' && perms.canResolveIncidents && (
        <button type="button" className="btn btn-secondary btn--xs" onClick={() => incAction(inc, 'resolve')}>Resolve</button>
      )}
      {perms.canComment && (
        <button type="button" className="btn btn-secondary btn--xs" onClick={() => incAction(inc, 'comment')}>Comment</button>
      )}
    </>
  );

  const lastRefreshLabel = lastRefresh ? formatIST(lastRefresh.toISOString(), true) : '—';

  return (
    <div className="alerts-container page-stack">
      <div className="al-view-bar">
        <nav className="al-view-switch" aria-label="Alerts workspace">
          <button type="button" className={`al-view-switch__btn ${view === 'alerts' ? 'is-active' : ''}`} onClick={() => onViewChange?.('alerts')}>
            Active alerts
            <span className="al-view-switch__n">{stats.active}</span>
          </button>
          <button type="button" className={`al-view-switch__btn ${view === 'incidents' ? 'is-active' : ''}`} onClick={() => onViewChange?.('incidents')}>
            Open incidents
            <span className="al-view-switch__n">{openIncidents.length}</span>
          </button>
        </nav>
        <p className="al-view-meta" role="status">
          Last refresh · {lastRefreshLabel}
          {openCritInc > 0 && view === 'incidents' ? ` · ${openCritInc} critical` : ''}
        </p>
      </div>

      <section className="al-kpi-row" aria-label="Operational summary" data-tour="page-alert-kpis">
        <button type="button" className="al-kpi card" onClick={() => { onViewChange?.('alerts'); setStatusF('ACTIVE'); setSevF('ALL'); }}>
          <span className="al-kpi__label">Active alerts</span>
          <span className="al-kpi__value">{stats.active}</span>
          <span className="al-kpi__hint">Across {stats.byBackend.length} backend{stats.byBackend.length === 1 ? '' : 's'}</span>
        </button>
        <button type="button" className="al-kpi card" onClick={() => { onViewChange?.('alerts'); setSevF('CRITICAL'); setStatusF('ACTIVE'); }}>
          <span className="al-kpi__label">Critical (active)</span>
          <span className="al-kpi__value al-kpi__value--crit">{critActive}</span>
          <span className="al-kpi__hint">Needs immediate triage</span>
        </button>
        <button type="button" className="al-kpi card" onClick={() => onViewChange?.('incidents')}>
          <span className="al-kpi__label">Open incidents</span>
          <span className="al-kpi__value">{openIncidents.length}</span>
          <span className="al-kpi__hint">{openCritInc} critical · {openIncidents.length - openCritInc} other</span>
        </button>
        <button type="button" className="al-kpi card" onClick={() => onViewChange?.('incidents')}>
          <span className="al-kpi__label">Unassigned incidents</span>
          <span className="al-kpi__value">{unassignedInc}</span>
          <span className="al-kpi__hint">No owner yet</span>
        </button>
      </section>

      {alerts.length >= FETCH_LIMIT && <p className="al-banner al-banner--warn" role="note">Showing the newest {FETCH_LIMIT} alerts; older records are not loaded in this view.</p>}

      {view === 'incidents' ? (
        <section className="al-inc-grid-wrap" aria-label="Incidents" data-tour="page-incidents">
          <p className="page-hint al-inc-grid-hint">
            Each incident groups alerts for one backend and rule. Parentheses show alerts still ACTIVE now.
          </p>
          <div className="dvt-toolbar" style={{ borderBottom: 'none', paddingTop: 0 }}>
            <ViewModeToggle value={incLayout} onChange={setIncLayout} includeCalendar />
            <span className="dvt-toolbar__count">{incidents.length} incident{incidents.length === 1 ? '' : 's'}</span>
          </div>
          {incidents.length === 0 ? (
            <div className="card al-card al-pad"><TableEmpty colSpan={1} title="No incidents" message="Incidents are created when rules escalate alerts." /></div>
          ) : incLayout === 'calendar' ? (
            <div className="card al-card al-pad">
              <OpsMonthCalendar
                title="Incident calendar"
                events={calEvents}
                onOpenEvent={(ev) => ev.open?.()}
              />
            </div>
          ) : incLayout === 'table' ? (
            <div className="card al-card">
              <div className="table-container">
                <table className="custom-table al-table">
                  <thead>
                    <tr><th>Backend</th><th>Rule</th><th>Severity</th><th>Status</th><th>Alerts</th><th>Owner</th><th>Detected</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {incRows.map((inc) => {
                      const { backendLabel, rule } = parseIncidentTitle(inc.title);
                      const activeNow = alerts.filter(
                        (a) => a.backend_id === inc.backend_id && String(inc.title).endsWith(a.alert_type) && a.status === 'ACTIVE',
                      ).length;
                      return (
                        <tr
                          key={inc.incident_id}
                          className="al-row-clickable"
                          tabIndex={0}
                          role="button"
                          onClick={() => openIncident(inc.incident_id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIncident(inc.incident_id); } }}
                        >
                          <td><span className="al-inc-card__title" style={{ fontSize: 13 }}>{backendLabel || inc.backend_id}</span></td>
                          <td>{rule || inc.backend_id}</td>
                          <td><SevBadge severity={inc.severity} /></td>
                          <td><StatusBadge status={inc.status} /></td>
                          <td>{inc.alert_count} <span className="al-sub">({activeNow} active)</span></td>
                          <td>{inc.owner || inc.acknowledged_by || 'Unassigned'}</td>
                          <td className="al-nowrap">{formatIST(inc.first_detected_at, false)}</td>
                          <td><div className="dvt-actions al-actions" onClick={stopRow} onKeyDown={stopRow}>{incActions(inc)}<button type="button" className="btn btn-secondary btn--xs" onClick={() => openIncident(inc.incident_id)}>Open workspace</button></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="al-inc-grid">
              {incRows.map((inc) => {
                const { backendLabel, rule } = parseIncidentTitle(inc.title);
                const activeNow = alerts.filter(
                  (a) => a.backend_id === inc.backend_id && String(inc.title).endsWith(a.alert_type) && a.status === 'ACTIVE',
                ).length;
                const dur = formatDurationMs(toMs(inc.last_detected_at) - toMs(inc.first_detected_at));
                return (
                  <article
                    key={inc.incident_id}
                    className="card al-inc-card dvt-card--clickable"
                    tabIndex={0}
                    role="button"
                    onClick={() => openIncident(inc.incident_id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIncident(inc.incident_id); } }}
                  >
                    <header className="al-inc-card__head">
                      <div>
                        <span className="al-inc-card__title">
                          {backendLabel || inc.backend_id}
                        </span>
                        <p className="al-sub">{rule || inc.backend_id} · <span className="admin-mono">{inc.incident_id}</span></p>
                      </div>
                      <div className="al-inc-card__badges">
                        <SevBadge severity={inc.severity} />
                        <StatusBadge status={inc.status} />
                      </div>
                    </header>
                    <dl className="al-inc-card__stats">
                      <div><dt>Alerts</dt><dd>{inc.alert_count} <span className="al-sub">({activeNow} active now)</span></dd></div>
                      <div><dt>Duration</dt><dd>{dur}</dd></div>
                      <div><dt>Owner</dt><dd>{inc.owner || inc.acknowledged_by || 'Unassigned'}</dd></div>
                      <div><dt>Detected</dt><dd className="al-nowrap">{formatIST(inc.first_detected_at, false)} → {formatIST(inc.last_detected_at, false)}</dd></div>
                    </dl>
                    <footer className="al-inc-card__foot" onClick={stopRow} onKeyDown={stopRow}>
                      <button type="button" className="btn btn-secondary btn--xs" onClick={() => openIncident(inc.incident_id)}>Open workspace</button>
                      <div className="al-actions">{incActions(inc)}</div>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
          <ListPager page={incCur} pages={incPages} onPage={setIncPage} />
        </section>
      ) : (
        <>
          <CollapsibleSection id="al-chart-h" title="Alert detections · last 24 hours" help="New alerts created per hour (IST), stacked by severity. Not the same as how many are still ACTIVE." className="card al-card al-pad al-chart-card" defaultOpen={false}>
            <p className="page-hint al-chart-hint">New detections per hour by severity — not the same as currently active count.</p>
            <QtECharts option={trendOption} style={{ height: 220, width: '100%' }} />
          </CollapsibleSection>

          <section className="al-summary" aria-label="Alert summary">
            <CollapsibleSection id="al-matrix-h" title="Severity × status" help="Click a cell to filter the table to that severity and status. Counts are from the loaded alert set (newest 500)." className="card al-card al-pad">
              <table className="al-matrix">
                <thead><tr><th scope="col"><span className="sr-only">Severity</span></th>{STATUSES.map((s) => <th key={s} scope="col">{s.toLowerCase()}</th>)}</tr></thead>
                <tbody>
                  {SEVERITIES.filter((s) => sevTotal(s) > 0 || s !== 'INFO').map((s) => (
                    <tr key={s}>
                      <th scope="row"><SevBadge severity={s} /></th>
                      {STATUSES.map((st) => {
                        const n = stats.m[`${s}|${st}`] || 0;
                        const on = sevF === s && statusF === st;
                        return (
                          <td key={st}>
                            <button type="button" className="al-cell" aria-pressed={on} disabled={!n} title={`Filter: ${s} ${st}`} onClick={() => { setSevF(on ? 'ALL' : s); setStatusF(on ? 'ALL' : st); }}>{n}</button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CollapsibleSection>
            <CollapsibleSection id="al-backend-h" title="Active alerts by backend" help="Share of currently ACTIVE alerts. Click a backend to filter the list. Red = critical, amber = warning." className="card al-card al-pad">
              {stats.byBackend.length === 0 ? <p className="page-hint">No active alerts.</p> : (
                <ul className="al-rank">
                  {stats.byBackend.map((b) => (
                    <li key={b.id}>
                      <button type="button" className="al-rank__row" aria-pressed={scopeBackend === b.id} onClick={() => setBackend(scopeBackend === b.id ? '' : b.id)} title="Filter table to this backend">
                        <span className="al-rank__name">{b.id}</span>
                        <span className="al-rank__bar" aria-hidden>
                          <span className="al-rank__seg al-rank__seg--crit" style={{ width: `${(b.CRITICAL / stats.byBackend[0].total) * 100}%` }} />
                          <span className="al-rank__seg al-rank__seg--warn" style={{ width: `${(b.WARNING / stats.byBackend[0].total) * 100}%` }} />
                        </span>
                        <span className="al-rank__n">{b.CRITICAL} crit · {b.WARNING} warn</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CollapsibleSection>
          </section>

          <section className="card al-card" aria-label="Alert list" data-tour="page-alert-filters">
            <div className="al-toolbar">
              <label className="al-search">
                <Search size={14} aria-hidden />
                <span className="sr-only">Search alerts</span>
                <input type="search" placeholder="Search id, qubit, message…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <label>Sort
                <select
                  className="input-control"
                  value={`${sort.key}:${sort.dir}`}
                  aria-label="Sort alerts"
                  onChange={(e) => {
                    const [key, dir] = e.target.value.split(':');
                    setSort({ key, dir });
                  }}
                >
                  <option value="severity:asc">Severity (critical first)</option>
                  <option value="severity:desc">Severity (low first)</option>
                  <option value="latest:desc">Latest detected</option>
                  <option value="latest:asc">Oldest detected</option>
                  <option value="backend:asc">Backend (A–Z)</option>
                  <option value="type:asc">Rule (A–Z)</option>
                </select>
              </label>
              <label>Severity
                <select className="input-control" value={sevF} onChange={(e) => setSevF(e.target.value)}>
                  <option value="ALL">All</option>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>Status
                <select className="input-control" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
                  <option value="ALL">All</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>Backend
                <select className="input-control" value={scopeBackend} onChange={(e) => setBackend(e.target.value)}>
                  <option value="">All ({backends.length})</option>
                  {backends.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <label className="al-check">
                <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} /> Group by backend + rule
              </label>
              <button type="button" className="btn btn-secondary btn--xs" onClick={clearFilters}>Reset filters</button>
              <ViewModeToggle value={listLayout} onChange={setListLayout} includeCalendar />
              <span className="al-count" role="status">{filtered.length} alert{filtered.length === 1 ? '' : 's'} · {rows.length} {grouped ? 'group' : 'row'}{rows.length === 1 ? '' : 's'}</span>
            </div>

            {listLayout === 'calendar' ? (
              <div className="al-pad">
                <OpsMonthCalendar
                  title="Alerts and incidents"
                  events={calEvents}
                  onOpenEvent={(ev) => ev.open?.()}
                />
              </div>
            ) : listLayout === 'grid' ? (
              <div className="dvt-grid" style={{ padding: 14 }}>
                {pageRows.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1' }}><TableEmpty colSpan={1} title={alerts.length === 0 ? 'No alerts recorded' : 'No alerts match filters'} message={alerts.length === 0 ? 'No alerts in the store.' : `Filters exclude all ${alerts.length} stored alerts.`} action={alerts.length ? <button type="button" className="btn btn-secondary btn--xs" onClick={clearFilters}>Reset filters</button> : undefined} /></div>
                ) : pageRows.map((g) => {
                  const multi = grouped && g.count > 1;
                  const a = g.items[0];
                  return (
                    <article
                      key={g.key}
                      className={`dvt-card${!multi ? ' dvt-card--clickable' : ''}`}
                      tabIndex={!multi ? 0 : undefined}
                      role={!multi ? 'button' : undefined}
                      onClick={!multi ? () => openAlert(a.alert_id) : undefined}
                      onKeyDown={!multi ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAlert(a.alert_id); } } : undefined}
                    >
                      <header className="dvt-card__head">
                        <div>
                          <h4 className="dvt-card__title">{g.type}</h4>
                          <p className="dvt-card__meta">{g.backend}{multi ? ` · ${g.count} alerts` : ''}</p>
                        </div>
                        <SevBadge severity={g.worst} />
                      </header>
                      <dl className="dvt-card__stats">
                        <div><dt>Observed</dt><dd>{multi ? `${num(g.lo)}–${num(g.hi)}` : num(a.current_value)} µs</dd></div>
                        <div><dt>Latest</dt><dd>{formatIST(g.latestIso, false)}</dd></div>
                      </dl>
                      <footer className="dvt-card__foot dvt-actions al-actions" onClick={stopRow} onKeyDown={stopRow}>
                        {multi ? (
                          <>
                            {g.open.length > 0 && perms.canAckAlerts && <button type="button" className="btn btn-secondary btn--xs" onClick={() => bulk('acknowledge', g.open)}>Ack {g.open.length}</button>}
                            {g.unresolved.length > 0 && perms.canResolveAlerts && <button type="button" className="btn btn-secondary btn--xs" onClick={() => bulk('resolve', g.unresolved)}>Resolve {g.unresolved.length}</button>}
                          </>
                        ) : (
                          <>
                            <button type="button" className="btn btn-secondary btn--xs" onClick={() => openAlert(a.alert_id)}>Open workspace</button>
                            {rowActions(a)}
                          </>
                        )}
                      </footer>
                    </article>
                  );
                })}
              </div>
            ) : (
            <div className="table-container">
              <table className="custom-table al-table">
                <thead>
                  <tr>
                    <th className="al-narrow"><span className="sr-only">Expand</span></th>
                    {sortTh('severity', 'Severity')}
                    {sortTh('type', 'Rule')}
                    {sortTh('backend', 'Backend')}
                    {sortTh('count', 'Alerts')}
                    <th>Observed vs threshold</th>
                    {sortTh('latest', 'Latest detected (IST)')}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <TableEmpty
                      colSpan={8}
                      title={alerts.length === 0 ? 'No alerts recorded' : 'No alerts match filters'}
                      message={alerts.length === 0 ? 'No alerts in the store.' : `Filters exclude all ${alerts.length} stored alerts.`}
                      action={alerts.length ? <button type="button" className="btn btn-secondary btn--xs" onClick={clearFilters}>Reset filters</button> : undefined}
                    />
                  ) : pageRows.map((g) => {
                    const multi = grouped && g.count > 1;
                    const a = g.items[0];
                    const open = expanded.has(g.key);
                    return (
                      <React.Fragment key={g.key}>
                        <tr
                          className={multi ? 'al-group-row' : 'al-row-clickable'}
                          tabIndex={!multi ? 0 : undefined}
                          role={!multi ? 'button' : undefined}
                          onClick={!multi ? () => openAlert(a.alert_id) : undefined}
                          onKeyDown={!multi ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAlert(a.alert_id); } } : undefined}
                        >
                          <td>{multi && (
                            <button type="button" className="al-twist" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${g.count} alerts for ${g.backend} ${g.type}`} onClick={(e) => { stopRow(e); toggleExpand(g.key); }}>
                              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          )}</td>
                          <td><SevBadge severity={g.worst} />{multi && <div className="al-sub"><Breakdown counts={g.sev} order={SEVERITIES} /></div>}</td>
                          <td><b>{g.type}</b>{!multi && qubitOf(a) && <div className="al-sub">{qubitOf(a)}</div>}</td>
                          <td>{g.backend}</td>
                          <td>{multi ? <><b>{g.count}</b><div className="al-sub"><Breakdown counts={g.st} order={STATUSES} /></div></> : <StatusBadge status={a.status} />}</td>
                          <td className="al-nowrap">
                            {multi ? `${num(g.lo)}–${num(g.hi)}` : num(a.current_value)} µs <span className="al-sub al-inline">vs {num(g.threshold)}</span>
                          </td>
                          <td className="al-nowrap">{formatIST(g.latestIso, false)}</td>
                          <td>
                            <div className="dvt-actions al-actions" onClick={stopRow} onKeyDown={stopRow}>
                              {multi ? (
                                <>
                                  <button type="button" className="btn btn-secondary btn--xs" onClick={() => toggleExpand(g.key)}>{open ? 'Hide' : 'Expand'}</button>
                                  {g.open.length > 0 && perms.canAckAlerts && (
                                    <button type="button" className="btn btn-secondary btn--xs" onClick={() => bulk('acknowledge', g.open)}>Ack {g.open.length}</button>
                                  )}
                                  {g.unresolved.length > 0 && perms.canResolveAlerts && (
                                    <button type="button" className="btn btn-secondary btn--xs" onClick={() => bulk('resolve', g.unresolved)}>Resolve {g.unresolved.length}</button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button type="button" className="btn btn-secondary btn--xs" onClick={(e) => { stopRow(e); openAlert(a.alert_id); }}>Open workspace</button>
                                  {rowActions(a)}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {multi && open && (() => {
                          const kids = g.items.slice().sort((x, y) => sevRank(x.severity) - sevRank(y.severity) || String(x.resource_id).localeCompare(String(y.resource_id), undefined, { numeric: true }));
                          const cpages = Math.max(1, Math.ceil(kids.length / CHILD_PAGE));
                          const cp = Math.min(childPage[g.key] || 1, cpages);
                          const shown = kids.slice((cp - 1) * CHILD_PAGE, cp * CHILD_PAGE);
                          return (
                            <>
                              {shown.map((c) => (
                                <tr
                                  key={c.alert_id}
                                  className="al-child-row al-row-clickable"
                                  tabIndex={0}
                                  role="button"
                                  onClick={() => openAlert(c.alert_id)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAlert(c.alert_id); } }}
                                >
                                  <td />
                                  <td><SevBadge severity={c.severity} /></td>
                                  <td>{qubitOf(c) || c.resource_type}</td>
                                  <td className="al-sub">{c.alert_id}</td>
                                  <td><StatusBadge status={c.status} /></td>
                                  <td className="al-nowrap">{num(c.current_value)} µs <span className="al-sub al-inline">vs {num(c.threshold_value)}</span></td>
                                  <td className="al-nowrap">{formatIST(c.detected_at, false)}</td>
                                  <td><div className="dvt-actions al-actions" onClick={stopRow} onKeyDown={stopRow}><button type="button" className="btn btn-secondary btn--xs" onClick={() => openAlert(c.alert_id)}>Open workspace</button>{rowActions(c)}</div></td>
                                </tr>
                              ))}
                              {cpages > 1 && (
                                <tr className="al-child-row">
                                  <td colSpan={8}>
                                    <ListPager
                                      page={cp}
                                      pages={cpages}
                                      onPage={(n) => setChildPage((p) => ({ ...p, [g.key]: n }))}
                                    />
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })()}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
            <ListPager page={curPage} pages={pages} onPage={setPage} />
          </section>
        </>
      )}

      <DetailDrawer
        open={!!drawerId}
        onClose={closeDrawer}
        title={drawerAlert ? drawerAlert.alert_id : (drawerId || 'Alert')}
        subtitle={drawerAlert ? `${drawerAlert.backend_id} · ${drawerAlert.alert_type}` : undefined}
        headerAside={drawerAlert ? <><SevBadge severity={drawerAlert.severity} /><StatusBadge status={drawerAlert.status} /></> : null}
        size="lg"
      >
        {!drawerAlert ? (
          <p className="page-hint">Alert {drawerId} is outside the loaded set (may be older than the newest {FETCH_LIMIT}). Open it from the list when listed.</p>
        ) : (() => {
          const a = drawerAlert; const inc = relatedIncident(a);
          const ratio = a.threshold_value ? Math.min(1.5, Math.max(0, a.current_value / a.threshold_value)) : null;
          return (
            <DetailModalBody>
              <DetailModalHero note={a.message} />
              <DetailModalSection title="Threshold vs observed">
                <div className="al-meter al-meter--detail" role="img" aria-label={`Observed ${num(a.current_value)}, threshold ${num(a.threshold_value)}`}>
                  <span className="al-meter__fill" style={{ width: `${(ratio ?? 0) / 1.5 * 100}%` }} />
                  <span className="al-meter__mark" style={{ left: `${100 / 1.5}%` }} />
                </div>
              </DetailModalSection>
              <DetailModalSection title="Details">
                <DetailModalDl>
                  <DetailModalRow label="Observed">{num(a.current_value)} µs</DetailModalRow>
                  <DetailModalRow label="Threshold">{num(a.threshold_value)} µs (alert when below)</DetailModalRow>
                  <DetailModalRow label="Backend">{a.backend_id}</DetailModalRow>
                  <DetailModalRow label="Resource">{a.resource_type} · {a.resource_id}</DetailModalRow>
                  <DetailModalRow label="Detected">{formatIST(a.detected_at)}</DetailModalRow>
                  <DetailModalRow label="Acknowledged by">{a.acknowledged_by || '—'}</DetailModalRow>
                  <DetailModalRow label="Resolved">{a.resolved_at ? formatIST(a.resolved_at) : '—'}</DetailModalRow>
                  <DetailModalRow label="Related incident">
                    {inc ? <button type="button" className="al-link" onClick={() => { closeDrawer(); openIncident(inc.incident_id); }}>{inc.title} ({inc.status})</button> : 'None linked'}
                  </DetailModalRow>
                </DetailModalDl>
              </DetailModalSection>
              <DetailModalRelated>
                <button type="button" className="btn btn-secondary" onClick={() => nav(timelineTo({ backendId: a.backend_id, alertId: a.alert_id, at: a.detected_at }))}>Timeline</button>
                <button type="button" className="btn btn-secondary" onClick={() => nav(healthTo(a.backend_id))}>Resource health</button>
                <button type="button" className="btn btn-secondary" onClick={() => openBackend(a.backend_id)}>Backend qubits</button>
                <button type="button" className="btn btn-secondary" onClick={() => nav(buildDriftInvestigationLocation({ backendId: a.backend_id }))}>Drift</button>
                {onOpenAlert && <button type="button" className="btn btn-primary" onClick={() => { closeDrawer(); onOpenAlert(a.alert_id); }}>Open full workspace</button>}
                <button type="button" className="btn btn-secondary" onClick={() => setAlertDiscOpen(true)}>Discussion ({(alertDetail?.comments || []).length})</button>
              </DetailModalRelated>
              <DetailModalSection title="Respond">
                <div className="al-actions">
                  {a.status === 'ACTIVE' && perms.canAckAlerts && (
                    <button type="button" className="btn btn-secondary" onClick={() => bulk('acknowledge', [a])}><Eye size={14} /> Acknowledge</button>
                  )}
                  {a.status !== 'RESOLVED' && perms.canResolveAlerts ? (
                    <button type="button" className="btn btn-primary" onClick={() => bulk('resolve', [a])}><Check size={14} /> Resolve</button>
                  ) : a.status === 'RESOLVED' ? (
                    <span className="page-hint">Already resolved.</span>
                  ) : !perms.canAckAlerts && !perms.canResolveAlerts ? (
                    <span className="page-hint">Read-only. No respond permission.</span>
                  ) : null}
                </div>
              </DetailModalSection>
            </DetailModalBody>
          );
        })()}
      </DetailDrawer>

      <DetailDrawer
        open={!!incDrawerId}
        onClose={() => setIncDrawerId(null)}
        title={(() => {
          const inc = incidents.find((i) => i.incident_id === incDrawerId);
          return inc?.incident_id || 'Incident';
        })()}
        subtitle={(() => {
          const inc = incidents.find((i) => i.incident_id === incDrawerId);
          return inc?.title;
        })()}
        headerAside={(() => {
          const inc = incidents.find((i) => i.incident_id === incDrawerId);
          return inc ? <><SevBadge severity={inc.severity} /><StatusBadge status={inc.status} /></> : null;
        })()}
        size="lg"
      >
        {(() => {
          const inc = incidents.find((i) => i.incident_id === incDrawerId);
          if (!inc) return <p className="page-hint">Incident not found.</p>;
          return (
            <DetailModalBody>
              <DetailModalHero note={inc.summary} />
              <DetailModalSection title="Details">
                <DetailModalDl>
                  <DetailModalRow label="Backend">{inc.backend_id}</DetailModalRow>
                  <DetailModalRow label="Alerts">{inc.alert_count}</DetailModalRow>
                  <DetailModalRow label="First detected">{formatIST(inc.first_detected_at)}</DetailModalRow>
                  <DetailModalRow label="Last detected">{formatIST(inc.last_detected_at)}</DetailModalRow>
                  <DetailModalRow label="Owner">{inc.owner || 'Unassigned'}</DetailModalRow>
                  <DetailModalRow label="Resolution">{inc.resolution_notes || '—'}</DetailModalRow>
                </DetailModalDl>
              </DetailModalSection>
              <DetailModalRelated>
                {onOpenIncident && <button type="button" className="btn btn-primary" onClick={() => { setIncDrawerId(null); onOpenIncident(inc.incident_id); }}>Open full workspace</button>}
                <button type="button" className="btn btn-secondary" onClick={() => nav(timelineTo({ backendId: inc.backend_id, at: inc.last_detected_at }))}>Timeline</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setIncDrawerId(null); setBackend(inc.backend_id); onViewChange?.('alerts'); }}>View its alerts</button>
                <button type="button" className="btn btn-secondary" onClick={() => setIncDiscOpen(true)}>Discussion ({(inc.comments || []).length})</button>
              </DetailModalRelated>
            </DetailModalBody>
          );
        })()}
      </DetailDrawer>

      <DiscussionModal
        open={alertDiscOpen && !!drawerAlert}
        onClose={() => setAlertDiscOpen(false)}
        title={`Discussion (${(alertDetail?.comments || []).length})`}
        comments={alertDetail?.comments || []}
        canComment={perms.canComment}
        actorName={actorName}
        role={currentUser?.role}
        busy={alertCommentBusy}
        onPost={async (text) => {
          if (!drawerAlert) return;
          setAlertCommentBusy(true);
          try {
            await api.addAlertComment(drawerAlert.alert_id, text);
            const d = await api.getAlert(drawerAlert.alert_id);
            setAlertDetail(d);
            notifySuccess('Comment posted.');
          } catch (err) {
            notifyError(err?.message || String(err));
          } finally {
            setAlertCommentBusy(false);
          }
        }}
      />
      <DiscussionModal
        open={incDiscOpen && !!incDrawerId}
        onClose={() => setIncDiscOpen(false)}
        title={`Discussion (${(incidents.find((i) => i.incident_id === incDrawerId)?.comments || []).length})`}
        comments={incidents.find((i) => i.incident_id === incDrawerId)?.comments || []}
        canComment={perms.canComment}
        actorName={actorName}
        role={currentUser?.role}
        busy={incCommentBusy}
        onPost={async (text) => {
          if (!incDrawerId) return;
          setIncCommentBusy(true);
          try {
            await api.addIncidentComment(incDrawerId, text);
            notifySuccess('Comment added.');
            await load();
          } catch (err) {
            notifyError(err?.message || String(err));
          } finally {
            setIncCommentBusy(false);
          }
        }}
      />

      {dlg && <ConfirmDialog dlg={dlg} busy={busy} onCancel={() => setDlg(null)} onConfirm={dlg.onConfirm} />}
    </div>
  );
};
