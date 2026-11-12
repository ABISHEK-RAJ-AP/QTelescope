import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, ArrowUp, ArrowDown, Check, Eye, CheckCircle2, PanelRightOpen,
} from 'lucide-react';
import { FilterBar } from '../components/ds/FilterBar.jsx';
import { PageRefreshCluster } from '../components/ui/PageRefreshCluster.jsx';
import { OpsMonthCalendar } from '../components/observability/OpsMonthCalendar.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { useAlertsSummary } from '../context/AlertsSummaryContext.jsx';
import { api, fetchApi } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { AnimatedNumber } from '../components/ui/AnimatedNumber.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
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
  DetailModalCallout,
} from '../components/observability/DetailModalLayout.jsx';
import { useAppScope } from '../hooks/useAppScope.js';
import { buildBackendDetailsPath, buildDriftInvestigationLocation } from '../lib/investigationLinks.js';
import { formatActivity, formatIST } from '../utils/time';
import { SevBadge, StatusBadge } from './opsShared.jsx';
import { sevRank, toMs, timelineTo, healthTo, qubitOf } from './opsHelpers.js';
import { notifyError, notifyOperatorNotice, notifySuccess } from '../lib/toast.js';
import { usePermissions } from '../hooks/usePermissions.js';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { getChartSemanticColors } from '../components/observability/chartTheme.js';
import { parseIncidentTitle } from '../lib/incidentUi.js';
import { ViewModeToggle } from '../components/observability/DataViewToolbar.jsx';
import { EnterpriseDataTable } from '../components/observability/EnterpriseDataTable.jsx';
import { ListPager } from '../components/observability/ListPager.jsx';
import { CollapsibleSection } from '../components/observability/CollapsibleSection.jsx';
import { DiscussionModal } from '../components/observability/DiscussionModal.jsx';
import { PageRelatedLink } from '../components/observability/PageRelatedNav.jsx';
import {
  formatObservedVsThreshold,
  formatObservedVsThresholdGroup,
  isMetricThresholdAlert,
} from '../lib/alertSemantics.js';
import { formatMetricValue } from '../lib/formatMetricValue.js';
import { formatBackendTitle } from '../lib/displayLabels.js';
import './AlertsEvents.css';

const FETCH_LIMIT = 500; // API max for /alerts
const PAGE_SIZE = 20;
const CHILD_PAGE = 12;
const SEVERITIES = ['CRITICAL', 'WARNING', 'INFO'];
const STATUSES = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'];
const num = (v, unit = 'µs') => formatMetricValue(v, { decimals: 1, unit, nullLabel: 'Not available' });

function ruleTitle(type) {
  const raw = String(type || '').replace(/_/g, ' ').toLowerCase();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Alert';
}

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

export const AlertsEvents = ({ view = 'alerts', onViewChange, onOpenIncident, onOpenAlertWorkspace, currentUser }) => {
  const nav = useNavigate();
  const perms = usePermissions(currentUser);
  const {
    backend: scopeBackend,
    alertId: scopeAlert,
    severity: scopeSeverity,
    status: scopeStatus,
    setBackend,
    setAlertId,
    setSeverity,
    setStatus,
  } = useAppScope();
  const { setActions, clearActions } = usePageActions();
  const {
    summary: alertSummary,
    activeCount,
    criticalCount,
    refreshSummary,
    invalidateSummary,
  } = useAlertsSummary();
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const [sevF, setSevF] = useState('ALL');
  const [statusF, setStatusF] = useState('ACTIVE');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const grouped = false;
  const [sort, setSort] = useState({ key: 'severity', dir: 'asc' });
  const [expanded, setExpanded] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [childPage, setChildPage] = useState({});
  const [incPage, setIncPage] = useState(1);
  const [incQuery, setIncQuery] = useState('');
  const [drawerId, setDrawerId] = useState(null);
  const [incDrawerId, setIncDrawerId] = useState(null);
  const stopRow = (e) => e.stopPropagation();
  const openAlert = useCallback((id) => {
    setDrawerId(id);
    setAlertId(id);
  }, [setAlertId]);
  const openIncident = useCallback((id) => {
    if (onOpenIncident) onOpenIncident(id);
    else setIncDrawerId(id);
  }, [onOpenIncident]);
  const [dlg, setDlg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [incCommentBusy, setIncCommentBusy] = useState(false);
  const [listLayout, setListLayout] = useState('table');
  const [incLayout, setIncLayout] = useState('table');
  const [alertDetail, setAlertDetail] = useState(null);
  const [alertCommentBusy, setAlertCommentBusy] = useState(false);
  const [alertDiscOpen, setAlertDiscOpen] = useState(false);
  const [incDiscOpen, setIncDiscOpen] = useState(false);
  const [hasMoreAlerts, setHasMoreAlerts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [registryIds, setRegistryIds] = useState(null);

  const applySevF = useCallback((v) => {
    setSevF(v);
    setSeverity(v === 'ALL' ? '' : v);
  }, [setSeverity]);

  const applyStatusF = useCallback((v) => {
    setStatusF(v);
    setStatus(v === 'ALL' ? '' : v);
  }, [setStatus]);

  useEffect(() => {
    if (scopeSeverity) setSevF(scopeSeverity);
  }, [scopeSeverity]);

  useEffect(() => {
    if (scopeStatus) setStatusF(scopeStatus);
  }, [scopeStatus]);

  const load = useCallback(async () => {
    try {
      const [a, i, bs] = await Promise.all([
        api.getAlerts(null, null, { limit: FETCH_LIMIT, offset: 0 }),
        api.getIncidents().catch(() => null),
        api.getBackends().catch(() => []),
      ]);
      await refreshSummary({ force: true }).catch(() => null);
      setAlerts(a || []);
      setRegistryIds(new Set((bs || []).map((b) => b.backend_id)));
      setHasMoreAlerts((a || []).length >= FETCH_LIMIT);
      setIncidents(i || []);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [refreshSummary]);

  const loadMoreAlerts = useCallback(async () => {
    if (loadingMore || !hasMoreAlerts) return;
    setLoadingMore(true);
    try {
      const batch = await api.getAlerts(null, null, { limit: FETCH_LIMIT, offset: alerts.length });
      const next = batch || [];
      setAlerts((prev) => [...prev, ...next]);
      setHasMoreAlerts(next.length >= FETCH_LIMIT);
    } catch (e) {
      notifyError(e?.message || 'Could not load older alerts');
    } finally {
      setLoadingMore(false);
    }
  }, [alerts.length, hasMoreAlerts, loadingMore]);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    setActions(<PageRefreshCluster onClick={load} lastRefreshAt={lastRefresh} label="Refresh alerts" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);
  useEffect(() => { setPage(1); setChildPage({}); }, [sevF, statusF, debouncedQuery, scopeBackend, grouped]);
  useEffect(() => {
    if (view !== 'alerts') {
      setDrawerId(null);
      return;
    }
    if (scopeAlert) setDrawerId(scopeAlert);
  }, [scopeAlert, view]);
  useEffect(() => {
    if (error && (alerts.length || incidents.length)) {
      notifyError(`Refresh failed: ${error}`, { toastId: 'alerts-load' });
    }
  }, [error, alerts.length, incidents.length]);

  const backends = useMemo(() => [...new Set(alerts.map((a) => a.backend_id).filter(Boolean))].sort(), [alerts]);

  const orphanBackends = useMemo(() => {
    if (!registryIds?.size) return [];
    const s = new Set();
    alerts.forEach((a) => {
      if (a.backend_id && !registryIds.has(a.backend_id)) s.add(a.backend_id);
    });
    return [...s].sort();
  }, [alerts, registryIds]);

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


  const trendOption = useMemo(() => {
    const sem = getChartSemanticColors();
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
        { name: 'Critical', type: 'bar', stack: 'alerts', data: crit, itemStyle: { color: sem.critical } },
        { name: 'Warning', type: 'bar', stack: 'alerts', data: warn, itemStyle: { color: sem.warn } },
      ],
    };
  }, [alerts]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return alerts.filter((a) => (
      (sevF === 'ALL' || a.severity === sevF)
      && (statusF === 'ALL' || a.status === statusF)
      && (!scopeBackend || a.backend_id === scopeBackend)
      && (!q || [a.alert_id, a.message, a.alert_type, a.backend_id, a.resource_id].some((f) => String(f || '').toLowerCase().includes(q)))
    ));
  }, [alerts, sevF, statusF, scopeBackend, debouncedQuery]);

  const rows = useMemo(() => {
    const cmp = SORTS[sort.key];
    const r = groupAlerts(filtered, grouped).sort(cmp);
    return sort.dir === 'desc' ? r.reverse() : r;
  }, [filtered, grouped, sort]);

  const filtersActive = sevF !== 'ALL' || statusF !== 'ACTIVE' || scopeBackend || debouncedQuery.trim();
  const listCountLabel = useMemo(() => {
    const n = filtered.length;
    if (!filtersActive) return `${n} in view`;
    return `${n} in view · filtered`;
  }, [filtered.length, filtersActive]);

  const orphanNoticeBody = useMemo(() => {
    if (!orphanBackends.length) return '';
    const names = orphanBackends.slice(0, 2).map((id) => formatBackendTitle({ backend_id: id })).join(', ');
    const extra = orphanBackends.length > 2 ? ` +${orphanBackends.length - 2}` : '';
    return `${names}${extra}: open alerts reference a backend not in the registry. Run discovery or add the processor in Integrations.`;
  }, [orphanBackends]);

  useEffect(() => {
    if (view !== 'alerts' || !orphanNoticeBody) return;
    notifyOperatorNotice({
      id: 'alerts-orphan-backend',
      title: 'Registry gap',
      body: orphanNoticeBody,
      variant: 'warn',
      actions: [
        { id: 'integrations', label: 'Integrations', href: '/app/admin/integrations' },
        { id: 'dismiss', label: 'Dismiss', dismiss: true },
      ],
    });
  }, [view, orphanNoticeBody]);

  useEffect(() => {
    if (view !== 'alerts' || activeCount == null || !filtersActive || filtered.length === activeCount) return;
    notifyOperatorNotice({
      id: 'alerts-scope',
      title: 'Scope',
      body: `${activeCount} active fleet-wide; this list shows ${filtered.length} with current filters.`,
      variant: 'info',
      actions: [{ id: 'dismiss', label: 'Dismiss', dismiss: true }],
      showToast: false,
    });
  }, [view, activeCount, filtersActive, filtered.length]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const curPage = Math.min(page, pages);
  const pageRows = rows.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  const alertById = useMemo(() => new Map(alerts.map((a) => [a.alert_id, a])), [alerts]);
  const drawerAlert = drawerId ? alertById.get(drawerId) : null;
  const openInc = incDrawerId ? incidents.find((i) => i.incident_id === incDrawerId) : null;

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

  const calTitle = view === 'incidents' ? 'Incident calendar' : 'Alerts and incidents';

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
      open: () => {
        if (onOpenIncident) onOpenIncident(inc.incident_id);
        else openIncident(inc.incident_id);
      },
    }));
    return view === 'incidents' ? incEv : [...alertEv, ...incEv];
  }, [filtered, incidents, view, openAlert, openIncident, onOpenIncident]);
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
  const patchAlerts = useCallback((items, patch) => {
    const ids = new Set(items.map((a) => a.alert_id));
    setAlerts((prev) => prev.map((a) => (ids.has(a.alert_id) ? { ...a, ...patch(a) } : a)));
  }, []);

  const run = async (fn, okMsg, { optimistic } = {}) => {
    setBusy(true);
    let rollback = null;
    if (optimistic) {
      const snapshot = alerts;
      rollback = () => setAlerts(snapshot);
      optimistic.apply();
    }
    try {
      const res = await fn();
      notifySuccess(typeof okMsg === 'function' ? okMsg(res) : okMsg);
      invalidateSummary();
      await Promise.all([load(), refreshSummary({ force: true }).catch(() => null)]);
    } catch (e) {
      if (rollback) rollback();
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
      }, (r) => `${isAck ? 'Acknowledged' : 'Resolved'} ${r.ok} alert(s)${r.failed ? `; ${r.failed} failed` : ''}.`, {
        optimistic: {
          apply: () => patchAlerts(items, () => (isAck
            ? { status: 'ACKNOWLEDGED', acknowledged_by: actorName }
            : { status: 'RESOLVED', resolved_at: new Date().toISOString() })),
        },
      }),
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
  const clearFilters = () => {
    setSevF('ALL');
    setStatusF('ALL');
    setQuery('');
    setBackend('');
    setSeverity('');
    setStatus('');
  };

  const toggleBackendFilter = useCallback((id) => {
    setBackend(scopeBackend === id ? '' : id);
  }, [scopeBackend, setBackend]);
  const toggleExpand = (k) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    return n;
  });
  const filteredIncidents = useMemo(() => {
    const q = incQuery.trim().toLowerCase();
    if (!q) return incidents;
    return incidents.filter((inc) => {
      const { backendLabel, rule } = parseIncidentTitle(inc.title);
      const hay = [
        inc.incident_id, inc.backend_id, backendLabel, rule,
        inc.status, inc.severity, inc.owner, inc.acknowledged_by, inc.title,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [incidents, incQuery]);

  const incPages = Math.max(1, Math.ceil(filteredIncidents.length / PAGE_SIZE));
  const incCur = Math.min(incPage, incPages);
  const incRows = filteredIncidents.slice((incCur - 1) * PAGE_SIZE, incCur * PAGE_SIZE);

  useEffect(() => setIncPage(1), [incQuery, incLayout]);
  const closeDrawer = useCallback(() => { setDrawerId(null); if (scopeAlert) setAlertId(''); }, [scopeAlert, setAlertId]);

  if (loading) return <BoneyardSkeleton layout="alerts" />;
  if (error && !alerts.length && !incidents.length) return <ErrorState message={error} onRetry={load} />;

  const sevTotal = (s) => STATUSES.reduce((n, st) => n + (stats.m[`${s}|${st}`] || 0), 0);
  const openIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const openCritInc = openIncidents.filter((i) => i.severity === 'CRITICAL').length;
  const unassignedInc = openIncidents.filter((i) => !i.owner && !i.acknowledged_by).length;

  const rowActions = (a, { compact = false } = {}) => (
    <>
      {a.status === 'ACTIVE' && perms.canAckAlerts && (
        <button
          type="button"
          className={compact ? 'al-icon-btn' : 'btn btn-secondary btn--xs'}
          title="Acknowledge"
          aria-label="Acknowledge"
          onClick={() => bulk('acknowledge', [a])}
        >
          {compact ? <Eye size={16} aria-hidden /> : 'Ack'}
        </button>
      )}
      {a.status !== 'RESOLVED' && perms.canResolveAlerts && (
        <button
          type="button"
          className={compact ? 'al-icon-btn al-icon-btn--primary' : 'btn btn-secondary btn--xs'}
          title="Resolve"
          aria-label="Resolve"
          onClick={() => bulk('resolve', [a])}
        >
          {compact ? <CheckCircle2 size={16} aria-hidden /> : 'Resolve'}
        </button>
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

  return (
    <div className="alerts-container page-stack">
      <div className="al-view-bar">
        <nav className="al-view-switch" aria-label="Alerts workspace">
          <button type="button" className={`al-view-switch__btn ${view === 'alerts' ? 'is-active' : ''}`} onClick={() => onViewChange?.('alerts')}>
            <span className="al-view-switch__label">Active alerts</span>
            <span className={`al-view-switch__n${stats.active ? '' : ' is-zero'}`}>{stats.active}</span>
          </button>
          <button type="button" className={`al-view-switch__btn ${view === 'incidents' ? 'is-active' : ''}`} onClick={() => onViewChange?.('incidents')}>
            <span className="al-view-switch__label">Open incidents</span>
            <span className={`al-view-switch__n${openIncidents.length ? '' : ' is-zero'}`}>{openIncidents.length}</span>
          </button>
        </nav>
        {openCritInc > 0 && view === 'incidents' ? (
          <p className="al-view-meta" role="status">{openCritInc} critical incident{openCritInc === 1 ? '' : 's'}</p>
        ) : null}
      </div>

      <section className="al-kpi-row al-kpi-row--glass" aria-label="Operational summary" data-tour="page-alert-kpis">
        <button type="button" className="al-kpi al-kpi--glass" onClick={() => { onViewChange?.('alerts'); applyStatusF('ACTIVE'); applySevF('ALL'); }}>
          <span className="al-kpi__label">Active alerts</span>
          <span className="al-kpi__value"><AnimatedNumber value={activeCount} /></span>
          <span className="al-kpi__hint">Across {Object.keys(alertSummary?.by_backend || {}).length || stats.byBackend.length} backend{(Object.keys(alertSummary?.by_backend || {}).length || stats.byBackend.length) === 1 ? '' : 's'}</span>
        </button>
        <button
          type="button"
          className={`al-kpi al-kpi--glass${criticalCount === 0 ? ' is-locked' : ''}`}
          disabled={criticalCount === 0}
          title={criticalCount === 0 ? 'No critical active alerts' : 'Filter to critical active alerts'}
          onClick={() => { onViewChange?.('alerts'); applySevF('CRITICAL'); applyStatusF('ACTIVE'); }}
        >
          <span className="al-kpi__label">Critical (active)</span>
          <span className="al-kpi__value al-kpi__value--crit"><AnimatedNumber value={criticalCount} /></span>
          <span className="al-kpi__hint">{criticalCount === 0 ? 'None right now' : 'Needs immediate triage'}</span>
        </button>
        <button type="button" className="al-kpi al-kpi--glass" onClick={() => onViewChange?.('incidents')}>
          <span className="al-kpi__label">Open incidents</span>
          <span className="al-kpi__value"><AnimatedNumber value={openIncidents.length} /></span>
          <span className="al-kpi__hint">{openCritInc} critical · {openIncidents.length - openCritInc} other</span>
        </button>
        <button
          type="button"
          className={`al-kpi al-kpi--glass${unassignedInc === 0 ? ' is-locked' : ''}`}
          disabled={unassignedInc === 0}
          title={unassignedInc === 0 ? 'All open incidents have an owner' : 'Show unassigned incidents'}
          onClick={() => onViewChange?.('incidents')}
        >
          <span className="al-kpi__label">Unassigned incidents</span>
          <span className="al-kpi__value"><AnimatedNumber value={unassignedInc} /></span>
          <span className="al-kpi__hint">{unassignedInc === 0 ? 'All assigned' : 'Needs an owner'}</span>
        </button>
      </section>

      <CollapsibleSection
        id="al-cal-section"
        title={calTitle}
        help="Grouped by day — open a day to inspect alerts and incidents."
        className="card al-cal-embed al-card al-cal-compact"
        defaultOpen
      >
        <div className="al-pad al-cal-compact__body">
          <OpsMonthCalendar
            layout="stacked"
            variant="default"
            dayDetailMode="modal"
            title={calTitle}
            events={calEvents}
            onOpenEvent={(ev) => {
              if (typeof ev?.open === 'function') ev.open();
              else if (ev?.kind === 'Incident') openIncident(ev.id);
              else openAlert(ev.id);
            }}
            canAckAlerts={perms.canAckAlerts}
            canResolveAlerts={perms.canResolveAlerts}
            onAckAlert={(ev) => {
              const a = alertById.get(ev.id);
              if (a) bulk('acknowledge', [a]);
            }}
            onResolveAlert={(ev) => {
              const a = alertById.get(ev.id);
              if (a) bulk('resolve', [a]);
            }}
          />
        </div>
      </CollapsibleSection>

      {view === 'incidents' ? (
        <section className="card al-card al-incidents-panel" aria-label="Incidents" data-tour="page-incidents">
          <FilterBar
            className="filter-bar--inline al-inc-filter"
            search={incQuery}
            onSearchChange={setIncQuery}
            searchPlaceholder="Search incidents…"
            searchLabel="Search incidents"
            count={`${filteredIncidents.length} of ${incidents.length} incident${incidents.length === 1 ? '' : 's'}`}
            actions={<ViewModeToggle value={incLayout} onChange={setIncLayout} />}
          />
          {incidents.length === 0 ? (
            <div className="al-pad"><TableEmpty colSpan={1} title="No incidents" message="Incidents are created when rules escalate alerts." /></div>
          ) : filteredIncidents.length === 0 ? (
            <div className="al-pad"><TableEmpty colSpan={1} title="No matches" message="Try a different search." action={<button type="button" className="btn btn-secondary btn--xs" onClick={() => setIncQuery('')}>Clear search</button>} /></div>
          ) : incLayout === 'table' ? (
            <div className="al-pad al-pad--table">
              <EnterpriseDataTable
                hideToolbar
                rows={filteredIncidents.map((inc) => {
                  const { backendLabel, rule } = parseIncidentTitle(inc.title);
                  const activeNow = alerts.filter(
                    (a) => a.backend_id === inc.backend_id && String(inc.title).endsWith(a.alert_type) && a.status === 'ACTIVE',
                  ).length;
                  return {
                    id: inc.incident_id,
                    backend: backendLabel || inc.backend_id,
                    rule: rule || inc.backend_id,
                    severity_rank: sevRank(inc.severity),
                    severity: inc.severity,
                    status: inc.status,
                    alerts_label: `${inc.alert_count} (${activeNow} active)`,
                    alert_count: inc.alert_count,
                    owner: inc.owner || inc.acknowledged_by || 'No owner',
                    detected_sort: toMs(inc.first_detected_at) ?? 0,
                    detected: formatIST(inc.first_detected_at, false),
                    _inc: inc,
                  };
                })}
                columns={[
                  { key: 'backend', label: 'Backend' },
                  { key: 'rule', label: 'Rule' },
                  {
                    key: 'severity_rank',
                    label: 'Severity',
                    defaultSortDir: 'asc',
                    render: (row) => <SevBadge severity={row.severity} />,
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (row) => <StatusBadge status={row.status} />,
                  },
                  { key: 'alerts_label', label: 'Alerts' },
                  { key: 'owner', label: 'Owner' },
                  { key: 'detected_sort', label: 'Detected', defaultSortDir: 'desc', render: (row) => row.detected },
                  {
                    key: 'id',
                    label: 'Actions',
                    sortable: false,
                    render: (row) => (
                      <div className="dvt-actions al-actions" onClick={stopRow} onKeyDown={stopRow}>
                        {incActions(row._inc)}
                        <button type="button" className="btn btn-secondary btn--xs" onClick={() => openIncident(row.id)}>Open workspace</button>
                      </div>
                    ),
                  },
                ]}
                pageSize={15}
                initialSort={{ key: 'detected_sort', dir: 'desc' }}
                ariaLabel="Incidents"
                onRowClick={(row) => openIncident(row.id)}
                tableClassName="custom-table al-table"
              />
            </div>
          ) : (
            <div className="al-inc-grid al-pad">
              {incRows.map((inc) => {
                const { backendLabel, rule } = parseIncidentTitle(inc.title);
                const activeNow = alerts.filter(
                  (a) => a.backend_id === inc.backend_id && String(inc.title).endsWith(a.alert_type) && a.status === 'ACTIVE',
                ).length;
                const activity = formatActivity(inc.last_detected_at);
                const headline = String(rule || inc.title || inc.backend_id || 'Incident').replace(/_/g, ' ');
                const backend = backendLabel || inc.backend_id;
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
                        <span className="al-inc-card__title">{headline}</span>
                        <p className="al-inc-card__meta">{backend} · {inc.alert_count} alerts · {activeNow} active · {activity}</p>
                      </div>
                      <div className="al-inc-card__badges">
                        <SevBadge severity={inc.severity} />
                        <StatusBadge status={inc.status} />
                      </div>
                    </header>
                    <dl className="al-inc-card__stats">
                      <div><dt>Owner</dt><dd>{inc.owner || inc.acknowledged_by || 'No owner'}</dd></div>
                      <div><dt>Last activity</dt><dd className="al-nowrap" title={formatIST(inc.last_detected_at, false)}>{activity}</dd></div>
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
          {incLayout === 'grid' && <ListPager page={incCur} pages={incPages} onPage={setIncPage} />}
        </section>
      ) : (
        <>
          <section className="card al-card al-card--list" aria-label="Alert list" data-tour="page-alert-filters">
            <FilterBar
              className="al-toolbar filter-bar--inline"
              search={query}
              onSearchChange={setQuery}
              searchPlaceholder="Search id, qubit, message…"
              searchLabel="Search alerts"
              count={listCountLabel}
              actions={(
                <>
                  <button type="button" className="btn btn-secondary btn--xs" onClick={clearFilters}>Reset filters</button>
                  <ViewModeToggle value={listLayout} onChange={setListLayout} />
                </>
              )}
            >
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
                <select className="input-control" value={sevF} onChange={(e) => applySevF(e.target.value)} aria-label="Filter by severity">
                  <option value="ALL">All</option>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>Status
                <select className="input-control" value={statusF} onChange={(e) => applyStatusF(e.target.value)} aria-label="Filter by status">
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
            </FilterBar>

            {listLayout === 'grid' ? (
              <div className="dvt-grid al-alert-grid">
                {pageRows.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1' }}><TableEmpty colSpan={1} title={alerts.length === 0 ? 'No alerts recorded' : 'No alerts match filters'} message={alerts.length === 0 ? 'No alerts in the store.' : `Filters exclude all ${alerts.length} stored alerts.`} action={alerts.length ? <button type="button" className="btn btn-secondary btn--xs" onClick={clearFilters}>Reset filters</button> : undefined} /></div>
                ) : pageRows.map((g) => {
                  const multi = grouped && g.count > 1;
                  const a = g.items[0];
                  return (
                    <article
                      key={g.key}
                      className={`dvt-card al-alert-card${!multi ? ' dvt-card--clickable' : ''}`}
                      data-severity={g.worst}
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
                        <div><dt>Signal</dt><dd>{formatObservedVsThresholdGroup(g)}</dd></div>
                        <div><dt>Latest</dt><dd>{formatIST(g.latestIso, false)}</dd></div>
                      </dl>
                      <footer className="dvt-card__foot al-card-foot" onClick={stopRow} onKeyDown={stopRow}>
                        {multi ? (
                          <div className="al-card-actions">
                            {g.open.length > 0 && perms.canAckAlerts && (
                              <button type="button" className="al-icon-btn" title={`Acknowledge ${g.open.length}`} aria-label={`Acknowledge ${g.open.length}`} onClick={() => bulk('acknowledge', g.open)}>
                                <Eye size={16} aria-hidden />
                                <span className="al-icon-btn__n">{g.open.length}</span>
                              </button>
                            )}
                            {g.unresolved.length > 0 && perms.canResolveAlerts && (
                              <button type="button" className="al-icon-btn al-icon-btn--primary" title={`Resolve ${g.unresolved.length}`} aria-label={`Resolve ${g.unresolved.length}`} onClick={() => bulk('resolve', g.unresolved)}>
                                <CheckCircle2 size={16} aria-hidden />
                                <span className="al-icon-btn__n">{g.unresolved.length}</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="al-card-actions">
                            <button type="button" className="al-icon-btn" title="Open details" aria-label="Open details" onClick={() => openAlert(a.alert_id)}>
                              <PanelRightOpen size={16} aria-hidden />
                            </button>
                            {rowActions(a, { compact: true })}
                          </div>
                        )}
                      </footer>
                    </article>
                  );
                })}
                {hasMoreAlerts ? (
                  <footer className="al-list-foot al-list-foot--grid">
                    <button type="button" className="btn btn-secondary btn--xs" disabled={loadingMore} onClick={loadMoreAlerts}>
                      {loadingMore ? 'Loading…' : 'Load older'}
                    </button>
                  </footer>
                ) : null}
              </div>
            ) : !grouped ? (
              <EnterpriseDataTable
                rows={rows.map((g) => {
                  const a = g.items[0];
                  return {
                    id: a.alert_id,
                    alert_id: a.alert_id,
                    severity_rank: sevRank(g.worst),
                    severity: g.worst,
                    type: g.type,
                    backend: g.backend,
                    status: a.status,
                    observed: formatObservedVsThreshold(a),
                    latest_sort: g.latest,
                    latest: formatIST(g.latestIso, false),
                    qubit: qubitOf(a) || '',
                    _alert: a,
                  };
                })}
                columns={[
                  {
                    key: 'severity_rank',
                    label: 'Severity',
                    defaultSortDir: 'asc',
                    render: (row) => <SevBadge severity={row.severity} />,
                  },
                  {
                    key: 'type',
                    label: 'Rule',
                    render: (row) => (
                      <>
                        <b>{row.type}</b>
                        {row.qubit ? <div className="al-sub">{row.qubit}</div> : null}
                      </>
                    ),
                  },
                  {
                    key: 'backend',
                    label: 'Backend',
                    render: (row) => (
                      <button
                        type="button"
                        className="al-backend-filter"
                        onClick={(e) => { e.stopPropagation(); toggleBackendFilter(row.backend); }}
                        aria-pressed={scopeBackend === row.backend}
                      >
                        {row.backend}
                      </button>
                    ),
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (row) => <StatusBadge status={row.status} />,
                  },
                  { key: 'observed', label: 'Signal', className: 'al-nowrap' },
                  { key: 'latest_sort', label: 'Latest detected (IST)', defaultSortDir: 'desc', render: (row) => row.latest },
                  {
                    key: 'alert_id',
                    label: 'Actions',
                    sortable: false,
                    render: (row) => (
                      <div className="dvt-actions al-actions" onClick={stopRow} onKeyDown={stopRow}>
                        <button type="button" className="btn btn-secondary btn--xs" onClick={() => openAlert(row.alert_id)}>Details</button>
                        {rowActions(row._alert)}
                      </div>
                    ),
                  },
                ]}
                searchKeys={['alert_id', 'type', 'backend', 'status', 'qubit']}
                searchPlaceholder="Search alerts…"
                pageSize={15}
                initialSort={{ key: 'severity_rank', dir: 'asc' }}
                ariaLabel="Alerts"
                onRowClick={(row) => openAlert(row.alert_id)}
                tableClassName="custom-table al-table"
                hideToolbarCount
                emptyTitle={alerts.length === 0 ? 'No alerts recorded' : 'No alerts match filters'}
                emptyMessage={alerts.length === 0 ? 'No alerts in the store.' : `Filters exclude all ${alerts.length} stored alerts.`}
              />
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
                    <th>Signal</th>
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
                          <td>
                            <button
                              type="button"
                              className="al-backend-filter"
                              aria-pressed={scopeBackend === g.backend}
                              onClick={(e) => { stopRow(e); toggleBackendFilter(g.backend); }}
                            >
                              {g.backend}
                            </button>
                          </td>
                          <td>{multi ? <><b>{g.count}</b><div className="al-sub"><Breakdown counts={g.st} order={STATUSES} /></div></> : <StatusBadge status={a.status} />}</td>
                          <td className="al-nowrap">{formatObservedVsThresholdGroup(g)}</td>
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
                                  <button type="button" className="btn btn-secondary btn--xs" onClick={(e) => { stopRow(e); openAlert(a.alert_id); }}>Details</button>
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
                                  <td className="al-nowrap">{formatObservedVsThreshold(c)}</td>
                                  <td className="al-nowrap">{formatIST(c.detected_at, false)}</td>
                                  <td><div className="dvt-actions al-actions" onClick={stopRow} onKeyDown={stopRow}><button type="button" className="btn btn-secondary btn--xs" onClick={() => openAlert(c.alert_id)}>Details</button>{rowActions(c)}</div></td>
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
            {listLayout === 'grid' && pages > 1 && <ListPager page={curPage} pages={pages} onPage={setPage} />}
            {listLayout !== 'grid' && hasMoreAlerts ? (
              <footer className="al-list-foot">
                <button type="button" className="btn btn-secondary btn--xs" disabled={loadingMore} onClick={loadMoreAlerts}>
                  {loadingMore ? 'Loading…' : 'Load older'}
                </button>
              </footer>
            ) : null}
          </section>

          <CollapsibleSection id="al-chart-h" title="Alert detections · last 24 hours" help="New alerts created per hour (IST), stacked by severity. Not the same as how many are still ACTIVE." className="card al-card al-pad al-chart-card" defaultOpen>
            <p className="page-hint al-chart-hint">New detections per hour by severity — not the same as currently active count.</p>
            <QtECharts option={trendOption} style={{ height: 220, width: '100%' }} />
          </CollapsibleSection>

          <section className="al-summary" aria-label="Alert summary">
            <CollapsibleSection id="al-matrix-h" title="Severity × status" defaultOpen help="Click a cell to filter the table to that severity and status. Counts are from the loaded alert set (newest 500)." className="card al-card al-pad">
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
                            <button type="button" className="al-cell" aria-pressed={on} disabled={!n} title={`Filter: ${s} ${st}`} onClick={() => { applySevF(on ? 'ALL' : s); applyStatusF(on ? 'ALL' : st); }}>{n}</button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CollapsibleSection>
            <CollapsibleSection id="al-backend-h" title="Active alerts by backend" defaultOpen help="Share of currently ACTIVE alerts. Click a backend to filter the list. Red = critical, amber = warning." className="card al-card al-pad">
              {stats.byBackend.length === 0 ? <p className="page-hint">No active alerts.</p> : (
                <ul className="al-rank">
                  {stats.byBackend.map((b) => (
                    <li key={b.id}>
                      <button type="button" className="al-rank__row" aria-pressed={scopeBackend === b.id} onClick={() => setBackend(scopeBackend === b.id ? '' : b.id)} title="Filter table to this backend">
                        <span className="al-rank__name">{formatBackendTitle({ backend_id: b.id })}</span>
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


        </>
      )}

      <DetailDrawer
        open={!!drawerId}
        onClose={closeDrawer}
        title={drawerAlert ? ruleTitle(drawerAlert.alert_type) : (drawerId ? 'Alert' : 'Alert')}
        subtitle={drawerAlert ? formatBackendTitle({ backend_id: drawerAlert.backend_id }) : undefined}
        headerAside={drawerAlert ? <><SevBadge severity={drawerAlert.severity} /><StatusBadge status={drawerAlert.status} /></> : null}
        size="lg"
        footer={drawerAlert ? (
          <div className="detail-drawer__foot-actions">
            <div className="detail-drawer__foot-secondary">
              {onOpenAlertWorkspace ? (
                <button type="button" className="btn btn-secondary" onClick={() => { closeDrawer(); onOpenAlertWorkspace(drawerAlert.alert_id); }}>
                  Open full workspace
                </button>
              ) : null}
            </div>
            <div className="detail-drawer__foot-respond" aria-label="Respond">
              {drawerAlert.status === 'ACTIVE' && perms.canAckAlerts ? (
                <button type="button" className="btn btn-secondary" onClick={() => bulk('acknowledge', [drawerAlert])}>
                  <Eye size={14} aria-hidden /> Acknowledge
                </button>
              ) : null}
              {drawerAlert.status !== 'RESOLVED' && perms.canResolveAlerts ? (
                <button type="button" className="btn btn-primary" onClick={() => bulk('resolve', [drawerAlert])}>
                  <Check size={14} aria-hidden /> Resolve
                </button>
              ) : drawerAlert.status === 'RESOLVED' ? (
                <span className="page-hint">Already resolved.</span>
              ) : !perms.canAckAlerts && !perms.canResolveAlerts ? (
                <span className="page-hint">Read-only.</span>
              ) : null}
            </div>
          </div>
        ) : null}
      >
        {!drawerAlert ? (
          <p className="page-hint">Alert {drawerId} is outside the loaded set (may be older than the newest {FETCH_LIMIT}). Open it from the list when listed.</p>
        ) : (() => {
          const a = drawerAlert; const inc = relatedIncident(a);
          const metricBreach = isMetricThresholdAlert(a);
          const ratio = metricBreach && a.threshold_value
            ? Math.min(1.5, Math.max(0, a.current_value / a.threshold_value))
            : null;
          return (
            <DetailModalBody className="dm-detail--alert">
              <DetailModalHero note={a.message} />
              {metricBreach ? (
                <DetailModalSection title="Threshold vs observed">
                  <div className="al-meter al-meter--detail" role="img" aria-label={`Observed ${num(a.current_value)}, threshold ${num(a.threshold_value)}`}>
                    <span className="al-meter__fill" style={{ width: `${(ratio ?? 0) / 1.5 * 100}%` }} />
                    <span className="al-meter__mark" style={{ left: `${100 / 1.5}%` }} />
                  </div>
                </DetailModalSection>
              ) : (
                <DetailModalSection title="Impact">
                  <DetailModalCallout>
                    Platform or connectivity alert. Threshold comparison does not apply — use Provider evidence in the full workspace when available.
                  </DetailModalCallout>
                </DetailModalSection>
              )}
              <DetailModalSection title="Details">
                <DetailModalDl>
                  <DetailModalRow label="Alert"><span className="admin-mono">{a.alert_id}</span></DetailModalRow>
                  {metricBreach ? (
                    <>
                      <DetailModalRow label="Observed">{num(a.current_value)}</DetailModalRow>
                      <DetailModalRow label="Threshold">{num(a.threshold_value)} (alert when below)</DetailModalRow>
                    </>
                  ) : null}
                  <DetailModalRow label="Backend">{formatBackendTitle({ backend_id: a.backend_id })}</DetailModalRow>
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
                <PageRelatedLink onClick={() => nav(timelineTo({ backendId: a.backend_id, alertId: a.alert_id, at: a.detected_at }))}>Timeline</PageRelatedLink>
                <PageRelatedLink onClick={() => nav(healthTo(a.backend_id))}>Resource health</PageRelatedLink>
                <PageRelatedLink onClick={() => openBackend(a.backend_id)}>Backend qubits</PageRelatedLink>
                <PageRelatedLink onClick={() => nav(buildDriftInvestigationLocation({ backendId: a.backend_id }))}>Drift</PageRelatedLink>
                <PageRelatedLink onClick={() => setAlertDiscOpen(true)}>Discussion ({(alertDetail?.comments || []).length})</PageRelatedLink>
              </DetailModalRelated>
            </DetailModalBody>
          );
        })()}
      </DetailDrawer>

      <DetailDrawer
        open={!!incDrawerId}
        onClose={() => setIncDrawerId(null)}
        title={openInc ? (parseIncidentTitle(openInc.title).rule || 'Incident') : 'Incident'}
        subtitle={openInc ? formatBackendTitle({ backend_id: openInc.backend_id }) : undefined}
        headerAside={openInc ? <><SevBadge severity={openInc.severity} /><StatusBadge status={openInc.status} /></> : null}
        size="lg"
        footer={openInc && onOpenIncident ? (
          <button type="button" className="btn btn-primary" onClick={() => { setIncDrawerId(null); onOpenIncident(openInc.incident_id); }}>Open full workspace</button>
        ) : null}
      >
        {!openInc ? (
          <p className="page-hint">Incident not found.</p>
        ) : (
          <DetailModalBody>
            <DetailModalHero note={openInc.summary} />
            <DetailModalSection title="Details">
              <DetailModalDl>
                <DetailModalRow label="Incident"><span className="admin-mono">{openInc.incident_id}</span></DetailModalRow>
                <DetailModalRow label="Backend">{formatBackendTitle({ backend_id: openInc.backend_id })}</DetailModalRow>
                <DetailModalRow label="Alerts">{openInc.alert_count}</DetailModalRow>
                <DetailModalRow label="First detected">{formatIST(openInc.first_detected_at)}</DetailModalRow>
                <DetailModalRow label="Last detected">{formatIST(openInc.last_detected_at)}</DetailModalRow>
                <DetailModalRow label="Owner">{openInc.owner || 'No owner'}</DetailModalRow>
                <DetailModalRow label="Resolution">{openInc.resolution_notes || '—'}</DetailModalRow>
              </DetailModalDl>
            </DetailModalSection>
            <DetailModalRelated>
              <PageRelatedLink onClick={() => nav(timelineTo({ backendId: openInc.backend_id, at: openInc.last_detected_at }))}>Timeline</PageRelatedLink>
              <PageRelatedLink onClick={() => { setIncDrawerId(null); setBackend(openInc.backend_id); onViewChange?.('alerts'); }}>View its alerts</PageRelatedLink>
              <PageRelatedLink onClick={() => setIncDiscOpen(true)}>Discussion ({(openInc.comments || []).length})</PageRelatedLink>
            </DetailModalRelated>
          </DetailModalBody>
        )}
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
