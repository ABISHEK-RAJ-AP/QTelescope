import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { notifyError, notifyWarn } from '../lib/toast.js';
import { api } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { PageRefreshCluster } from '../components/ui/PageRefreshCluster.jsx';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { CollapsibleSection } from '../components/observability/CollapsibleSection.jsx';
import { ExceptionStrip } from '../components/observability/ExceptionStrip.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { formatISTTime } from '../utils/time';
import { buildBackendDetailsPath, buildTimelineInvestigationLocation } from '../lib/investigationLinks.js';
import { STALE_MIN, ageMinutes, fetchActiveAlerts, groupAlerts, lineageByProvider, sevBadge } from './fleetData.js';
import { LayoutGrid, List } from 'lucide-react';
import { OpsMonthCalendar } from '../components/observability/OpsMonthCalendar.jsx';
import { dropAlertsCoveredByIncidents, toMs } from './opsHelpers.js';
import { LineageChip } from './fleetShared.jsx';
import { collectorQueueTitle } from '../utils/operatorFault.js';
import { parseIncidentTitle } from '../lib/incidentUi.js';
import './OperationsCentre.css';

const HEALTH_PATH = '/app/resources/health';
const SOURCES = ['centre', 'alerts', 'health', 'incidents'];

const LANES = [
  ['ack', 'Acknowledgement', 'Open incidents and unowned alert groups.'],
  ['inv', 'Investigation', 'Degraded backends, stale collectors, or unknown health.'],
  ['fix', 'Remediation', 'Advisory routing from the health engine.'],
  ['info', 'Informational', 'Acknowledged alerts and lower-priority context.'],
];

const LANE_EMPTY = {
  ack: 'No incidents or alert groups awaiting acknowledgement.',
  inv: 'No backends or collectors require investigation.',
  fix: 'No advisory quarantine or recalibration items.',
  info: 'No informational items in the queue.',
};

const LANE_TONE = {
  ack: 'warn',
  inv: 'neutral',
  fix: 'critical',
  info: 'ok',
};

/** One clear destination per row — avoids bean clutter. */
function pickPrimaryLink(links = []) {
  const order = ['Incident', 'Alerts', 'Backend', 'Platform health', 'Qubit health'];
  for (const label of order) {
    const hit = links.find((l) => l.label === label);
    if (hit) return hit;
  }
  return links[0];
}

/** Colour + number only. Words stay in the accessible name, not the visible title. */
function QubitBeans({ counts }) {
  const red = Number(counts?.RED) || 0;
  const yellow = Number(counts?.YELLOW) || 0;
  const qubitWord = (n) => (n === 1 ? 'qubit' : 'qubits');
  return (
    <span className="oc-qubits" aria-label={`${red} red ${qubitWord(red)}, ${yellow} yellow ${qubitWord(yellow)}`}>
      <span className="oc-qubit oc-qubit--red" title="Red qubits">{red}</span>
      <span className="oc-qubit oc-qubit--yellow" title="Yellow qubits">{yellow}</span>
    </span>
  );
}

function factLine(facts) {
  if (!facts?.length) return null;
  return facts.map((f) => `${f.label} ${f.value}`).join(' · ');
}

function QueueRow({ item, laneLabel, layout, showLane }) {
  const sev = item.severity || 'INFO';
  const primary = pickPrimaryLink(item.links);
  const facts = factLine(item.facts);
  const titleHasBackend = item.backend && item.title?.includes(item.backend);

  return (
    <li className={`oc-item${layout === 'grid' ? ' oc-item--grid' : ''}`}>
      <div className="oc-item__main">
        <span className={`badge ${sevBadge(sev)} oc-item__badge`}>{sev}</span>
        <div className="oc-item__body">
          <div className="oc-item__title">{item.title}</div>
          {item.detail ? <p className="oc-item__detail">{item.detail}</p> : null}
          {item.counts && <QubitBeans counts={item.counts} />}
          <div className="oc-item__meta">
            {showLane && <span className="oc-item__lane">{laneLabel}</span>}
            {item.backend && !titleHasBackend ? <code className="oc-item__backend">{item.backend}</code> : null}
            {facts && <span className="oc-item__facts">{facts}</span>}
            {item.lineage && <LineageChip lineage={item.lineage} />}
            {item.meta && <span className="oc-item__time">{item.meta}</span>}
          </div>
        </div>
      </div>
      {primary && (
        <Link className="btn btn-secondary oc-item__cta" to={primary.to}>{primary.label}</Link>
      )}
    </li>
  );
}

export const OperationsCentre = () => {
  const [d, setD] = useState({});
  const [failed, setFailed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [laneFilter, setLaneFilter] = useState('ack');
  const [queueView, setQueueView] = useState('list');
  const { setActions, clearActions } = usePageActions();

  const mergeSources = useCallback((keys, res) => {
    const bad = [];
    setD((prev) => {
      const next = { ...prev };
      res.forEach((r, i) => {
        if (r.status === 'fulfilled') next[keys[i]] = r.value;
        else bad.push(keys[i]);
      });
      return next;
    });
    setFailed((prev) => [...new Set([...prev.filter((x) => !keys.includes(x)), ...bad])]);
    if (res.some((r) => r.status === 'fulfilled')) setLastRefresh(new Date());
  }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const primary = await Promise.allSettled([api.getOperationsCentre()]);
    mergeSources(['centre'], primary);
    if (!silent) setLoading(false);

    const secondary = await Promise.allSettled([
      fetchActiveAlerts(200),
      api.getHealthVector(),
      api.getIncidents(undefined, { limit: 100 }),
    ]);
    mergeSources(['alerts', 'health', 'incidents'], secondary);
  }, [mergeSources]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load({ silent: true }); }, 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    setActions(<PageRefreshCluster onClick={load} lastRefreshAt={lastRefresh} label="Refresh operator console" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  const providers = d.centre?.collectors?.providers;
  const lanes = useMemo(() => {
    const lineage = lineageByProvider(providers || []);
    const provOf = Object.fromEntries((d.centre?.backends_snapshot || []).map((b) => [b.backend_id, b.provider_id]));
    const lin = (id) => lineage[provOf[id]] || null;
    const tl = (backendId, alertId) => buildTimelineInvestigationLocation({ backendId, alertId });
    const out = { ack: [], inv: [], fix: [], info: [] };

    const incidents = Array.isArray(d.incidents) ? d.incidents : (d.centre?.incidents || []);
    const incBackends = new Set();
    incidents.filter((i) => !['RESOLVED', 'CLOSED'].includes(i.status)).forEach((i) => {
      incBackends.add(i.backend_id);
      const unowned = i.status === 'OPEN' && !i.acknowledged_by;
      const { backendLabel, rule } = parseIncidentTitle(i.title);
      const incTitle = rule ? `${backendLabel || i.backend_id} · ${rule}` : i.title;
      (unowned ? out.ack : out.inv).push({
        key: i.incident_id, severity: i.severity, title: incTitle, backend: i.backend_id, lineage: lin(i.backend_id),
        facts: [
          { label: 'Status', value: i.status || '—' },
          { label: 'Alerts', value: i.alert_count ?? '—' },
          { label: 'Updated', value: formatISTTime(i.last_detected_at) },
        ],
        links: [
          { label: 'Incident', to: '/app/alerts/incidents' },
          { label: 'Backend', to: buildBackendDetailsPath(i.backend_id) },
          { label: 'Timeline', to: tl(i.backend_id) },
        ],
      });
    });

    groupAlerts(Array.isArray(d.alerts) ? d.alerts : []).forEach((g) => {
      const covered = incBackends.has(g.backend_id);
      const lane = g.unacked === 0 ? 'info' : covered ? null : 'ack';
      if (!lane) return;
      out[lane].push({
        key: g.key, severity: g.severity, backend: g.backend_id, lineage: lin(g.backend_id),
        title: g.count > 1 ? `${g.alert_type} · ${g.count} alerts` : g.alert_type,
        detail: g.sample,
        meta: `${g.backend_id} · ${formatISTTime(g.latest)} · ${g.unacked} unacked`,
        links: [
          { label: 'Alerts', to: '/app/alerts' },
          { label: 'Backend', to: buildBackendDetailsPath(g.backend_id) },
          { label: 'Timeline', to: tl(g.backend_id, g.ids[0]) },
        ],
      });
    });

    (d.health?.backends || []).forEach((h) => {
      const act = h.recommended_action;
      if (act && !['ALLOW', 'HOLD'].includes(act)) {
        out.fix.push({
          key: `fix-${h.backend_id}`, severity: h.router === 'RED' ? 'CRITICAL' : 'WARNING',
          title: String(act).replace(/_/g, ' '),
          counts: { RED: h.counts?.RED || 0, YELLOW: h.counts?.YELLOW || 0 },
          backend: h.backend_id, lineage: lin(h.backend_id), meta: 'Routing recommendation',
          links: [{ label: 'Qubit health', to: HEALTH_PATH }, { label: 'Backend', to: buildBackendDetailsPath(h.backend_id, 'calibration') }],
        });
      } else if (h.router === 'UNKNOWN') {
        out.inv.push({
          key: `unk-${h.backend_id}`, severity: 'WARNING', title: 'No qubit telemetry — health unknown',
          backend: h.backend_id, lineage: lin(h.backend_id), meta: h.recommended_action,
          links: [{ label: 'Qubit health', to: HEALTH_PATH }, { label: 'Backend', to: buildBackendDetailsPath(h.backend_id) }],
        });
      }
    });

    (d.centre?.backends_snapshot || []).filter((b) => b.operational_status !== 'ONLINE').forEach((b) => {
      out.inv.push({
        key: `off-${b.backend_id}`, severity: 'CRITICAL', title: `Backend ${b.operational_status}`, backend: b.backend_id,
        lineage: lin(b.backend_id), links: [{ label: 'Backend', to: buildBackendDetailsPath(b.backend_id) }, { label: 'Timeline', to: tl(b.backend_id) }],
      });
    });

    (providers || []).forEach((p) => {
      const age = ageMinutes(p.last_success_at);
      const bad = p.status !== 'OK';
      if (bad || (age != null && age > STALE_MIN)) {
        out.inv.push({
          key: `col-${p.provider_id}`, severity: bad ? 'CRITICAL' : 'WARNING',
          title: collectorQueueTitle(p.provider_id, p, { stale: !bad && age != null && age > STALE_MIN }),
          meta: `last success ${age != null ? `${Math.round(age)} min ago` : 'unknown'}`, lineage: p.lineage,
          links: [{ label: 'Platform health', to: '/app/platform/health' }],
        });
      }
    });

    Object.values(out).forEach((l) => l.sort((a, b) => (a.severity === 'CRITICAL' ? 0 : 1) - (b.severity === 'CRITICAL' ? 0 : 1)));
    return out;
  }, [d, providers]);

  const critCount = useMemo(
    () => Object.values(lanes).flat().filter((i) => i.severity === 'CRITICAL').length,
    [lanes],
  );
  const warnCount = useMemo(
    () => Object.values(lanes).flat().filter((i) => i.severity === 'WARNING').length,
    [lanes],
  );

  const laneMeta = useMemo(
    () => Object.fromEntries(LANES.map(([id, title, sub]) => [id, { title, sub }])),
    [],
  );

  const visibleItems = useMemo(() => {
    const raw = laneFilter === 'all'
      ? LANES.flatMap(([id]) => lanes[id].map((item) => ({ item, laneId: id })))
      : (lanes[laneFilter] || []).map((item) => ({ item, laneId: laneFilter }));
    const rank = (s) => ({ CRITICAL: 0, WARNING: 1, INFO: 2 }[s] ?? 3);
    return raw.slice().sort((a, b) => rank(a.item.severity) - rank(b.item.severity) || a.laneId.localeCompare(b.laneId));
  }, [laneFilter, lanes]);

  const actionable = useMemo(
    () => lanes.ack.length + lanes.inv.length + lanes.fix.length,
    [lanes],
  );

  const calEvents = useMemo(() => {
    const alerts = Array.isArray(d.alerts) ? d.alerts : [];
    const incidents = Array.isArray(d.incidents) ? d.incidents : (d.centre?.incidents || []);
    const alertEv = alerts.map((a) => ({
      id: a.alert_id,
      at: a.detected_at,
      title: `${a.backend_id} ${a.alert_type}`,
      subtitle: a.alert_id,
      groupKey: `alert|${a.backend_id}|${a.alert_type}`,
      kind: 'Alert',
      alertType: a.alert_type,
      backendId: a.backend_id,
      severity: a.severity,
      status: a.status,
      open: () => window.location.assign(`/app/alerts?alert=${encodeURIComponent(a.alert_id)}`),
    }));
    const incEv = incidents.map((inc) => ({
      id: inc.incident_id,
      at: inc.first_detected_at || inc.created_at,
      title: inc.title || inc.incident_id,
      subtitle: inc.incident_id,
      groupKey: `incident|${inc.incident_id}`,
      kind: 'Incident',
      backendId: inc.backend_id,
      severity: inc.severity,
      status: inc.status,
      open: () => window.location.assign(`/app/alerts/incidents/${encodeURIComponent(inc.incident_id)}`),
    }));
    return dropAlertsCoveredByIncidents([...alertEv, ...incEv]).filter((e) => toMs(e.at));
  }, [d]);

  const staleCollectors = useMemo(() => (providers || []).filter((p) => {
    const age = ageMinutes(p.last_success_at);
    return p.status !== 'OK' || (age != null && age > STALE_MIN);
  }).length, [providers]);

  useEffect(() => {
    const firstBusy = LANES.find(([id]) => lanes[id].length > 0);
    if (firstBusy && lanes[laneFilter]?.length === 0) {
      setLaneFilter(firstBusy[0]);
    }
  }, [lanes, laneFilter]);

  const noData = failed.length === SOURCES.length;

  useEffect(() => {
    if (loading || !failed.length) return;
    const when = lastRefresh ? ` Last good load ${formatISTTime(lastRefresh)}.` : '';
    const msg = noData
      ? `Backend unreachable.${when}`
      : `Partial load: ${failed.join(', ')} failed — some queue items may be missing.${when}`;
    if (noData) notifyError(msg, { toastId: 'ops-load' });
    else notifyWarn(msg, { toastId: 'ops-load' });
  }, [loading, failed, noData, lastRefresh]);

  if (loading) return <BoneyardSkeleton layout="ops" />;

  return (
    <div className="ops-page page-stack" data-tour="page-operations-centre">
      <ExceptionStrip
        data-tour="page-ops-kpis"
        ariaLabel="Action queue summary"
        items={[
          {
            id: 'ack', label: 'Acknowledgement', value: lanes.ack.length,
            sub: lanes.ack.length ? 'Needs owner' : 'Queue clear',
            tone: lanes.ack.length ? (lanes.ack.some((i) => i.severity === 'CRITICAL') ? 'critical' : 'warn') : 'ok',
            onClick: () => setLaneFilter('ack'),
            help: 'Open incidents and unowned alert groups waiting for acknowledgement.',
          },
          {
            id: 'inv', label: 'Investigation', value: lanes.inv.length,
            sub: staleCollectors ? `${staleCollectors} collectors stale` : 'Collectors OK',
            tone: lanes.inv.length ? 'warn' : 'ok',
            onClick: () => setLaneFilter('inv'),
            help: 'Degraded backends, stale collectors, or unknown health.',
          },
          {
            id: 'fix', label: 'Remediation', value: lanes.fix.length,
            sub: lanes.fix.length ? 'Routing advisories' : 'No quarantine',
            tone: lanes.fix.some((i) => i.severity === 'CRITICAL') ? 'critical' : lanes.fix.length ? 'warn' : 'ok',
            onClick: () => setLaneFilter('fix'),
            help: 'Health-engine routing recommendations (recalibrate / quarantine).',
          },
          {
            id: 'info', label: 'Informational', value: lanes.info.length,
            sub: `${critCount} crit · ${warnCount} warn`,
            tone: 'ok',
            onClick: () => setLaneFilter('info'),
            help: 'Acknowledged alerts and lower-priority context.',
          },
        ]}
      />

      <CollapsibleSection
        id="oc-cal-section"
        title="Activity calendar"
        help="Day-level alerts and incidents. Primary triage stays in the action queue below."
        className="card oc-cal-embed oc-cal-panel"
        defaultOpen={false}
      >
        <OpsMonthCalendar
          layout="stacked"
          variant="default"
          dayDetailMode="modal"
          title="Alerts and incidents"
          events={calEvents}
          onOpenEvent={(ev) => ev.open?.()}
        />
      </CollapsibleSection>

      {!noData && actionable === 0 && (
        <EmptyState compact variant="panel" title="Action queue empty" message="No items pending acknowledgement, investigation, or remediation." />
      )}

      <section className="card oc-queue" aria-labelledby="oc-queue-h">
        <header className="oc-queue__head">
          <div>
            <h2 id="oc-queue-h" className="oc-queue__title">Action queue</h2>
            <p className="oc-queue__sub">Work queue. Fleet charts stay on Fleet overview.</p>
          </div>
          <div className="oc-queue__controls">
            <nav className="oc-lane-tabs" aria-label="Queue lanes">
            <button
              type="button"
              className={`oc-lane-tab${laneFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => setLaneFilter('all')}
            >
              All <span className="oc-count">{actionable + lanes.info.length}</span>
            </button>
            {LANES.map(([id, title]) => (
              <button
                key={id}
                type="button"
                className={`oc-lane-tab oc-lane-tab--${id}${laneFilter === id ? ' is-active' : ''}`}
                onClick={() => setLaneFilter(id)}
              >
                {title} <span className="oc-count" data-tone={LANE_TONE[id]}>{lanes[id].length}</span>
              </button>
            ))}
            </nav>
            <div className="oc-view-toggle" role="group" aria-label="Queue layout">
              <button
                type="button"
                className={`oc-view-toggle__btn${queueView === 'list' ? ' is-active' : ''}`}
                aria-pressed={queueView === 'list'}
                title="List view"
                onClick={() => setQueueView('list')}
              >
                <List size={18} aria-hidden />
                <span className="oc-view-toggle__label">List</span>
              </button>
              <button
                type="button"
                className={`oc-view-toggle__btn${queueView === 'grid' ? ' is-active' : ''}`}
                aria-pressed={queueView === 'grid'}
                title="Grid view"
                onClick={() => setQueueView('grid')}
              >
                <LayoutGrid size={18} aria-hidden />
                <span className="oc-view-toggle__label">Grid</span>
              </button>
            </div>
          </div>
        </header>

        <div className="oc-queue__body">
          <p className="oc-queue__lane-desc">{laneFilter === 'all' ? 'All open items, critical first within each lane.' : laneMeta[laneFilter]?.sub}</p>
          {visibleItems.length === 0 ? (
            <p className="oc-lane-empty">{laneFilter === 'all' ? 'Queue clear — nothing requires action.' : LANE_EMPTY[laneFilter]}</p>
          ) : (
            <ul className={queueView === 'grid' ? 'oc-list oc-list--grid' : 'oc-list'}>
              {visibleItems.map(({ item, laneId }) => (
                <QueueRow
                  key={item.key}
                  item={item}
                  laneLabel={laneMeta[laneId]?.title}
                  layout={queueView}
                  showLane={laneFilter === 'all'}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

    </div>
  );
};
