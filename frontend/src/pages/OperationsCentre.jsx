import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { ExceptionStrip } from '../components/observability/ExceptionStrip.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { formatISTTime } from '../utils/time';
import { buildBackendDetailsPath, buildTimelineInvestigationLocation } from '../lib/investigationLinks.js';
import { STALE_MIN, ageMinutes, fetchActiveAlerts, groupAlerts, lineageByProvider, sevBadge } from './fleetData.js';
import { LineageChip } from './fleetShared.jsx';
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

function Row({ item }) {
  const sev = item.severity || 'INFO';
  return (
    <li className={`oc-item oc-item--${sev}`}>
      <div className="oc-item__main">
        <span className={`badge ${sevBadge(sev)}`}>{sev}</span>
        <div className="oc-item__body">
          <div className="oc-item__title">{item.title}</div>
          <div className="oc-item__meta">
            {item.backend && <code>{item.backend}</code>}
            {item.lineage && <LineageChip lineage={item.lineage} />}
            {item.meta && <span>{item.meta}</span>}
          </div>
        </div>
      </div>
      <div className="oc-item__actions">
        {item.links.map((l) => (
          <Link key={l.label} className="qts-bean" to={l.to}>{l.label}</Link>
        ))}
      </div>
    </li>
  );
}

function pickTopItem(lanes) {
  const order = ['ack', 'inv', 'fix', 'info'];
  for (const id of order) {
    const crit = lanes[id].find((i) => i.severity === 'CRITICAL');
    if (crit) return { lane: id, item: crit };
  }
  for (const id of order) {
    if (lanes[id][0]) return { lane: id, item: lanes[id][0] };
  }
  return null;
}

export const OperationsCentre = () => {
  const navigate = useNavigate();
  const [d, setD] = useState({});
  const [failed, setFailed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const { setActions, clearActions } = usePageActions();

  const load = useCallback(async () => {
    const calls = {
      centre: api.getOperationsCentre(), alerts: fetchActiveAlerts(),
      health: api.getHealthVector(), incidents: api.getIncidents(),
    };
    const res = await Promise.allSettled(SOURCES.map((k) => calls[k]));
    const bad = [];
    setD((prev) => {
      const next = { ...prev };
      res.forEach((r, i) => { if (r.status === 'fulfilled') next[SOURCES[i]] = r.value; else bad.push(SOURCES[i]); });
      return next;
    });
    setFailed(bad);
    if (bad.length < SOURCES.length) setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh operator console" />);
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
      (unowned ? out.ack : out.inv).push({
        key: i.incident_id, severity: i.severity, title: i.title, backend: i.backend_id, lineage: lin(i.backend_id),
        meta: `${i.status} · ${i.alert_count ?? '?'} alerts · last ${formatISTTime(i.last_detected_at)}`,
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
        title: `${g.count} × ${g.alert_type}${g.count > 1 ? ' alerts' : ' alert'} — ${g.sample}`,
        meta: `latest ${formatISTTime(g.latest)} · ${g.unacked} unacknowledged`,
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
          title: `${act.replace(/_/g, ' ')} — ${h.counts?.RED || 0} red, ${h.counts?.YELLOW || 0} yellow qubits`,
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
          title: `Collector ${p.provider_id}: ${bad ? p.status : 'stale'}${p.error ? ` — ${p.error}` : ''}`,
          meta: `last success ${age != null ? `${Math.round(age)} min ago` : 'unknown'}`, lineage: p.lineage,
          links: [{ label: 'Platform health', to: '/app/platform/health' }],
        });
      }
    });

    Object.values(out).forEach((l) => l.sort((a, b) => (a.severity === 'CRITICAL' ? 0 : 1) - (b.severity === 'CRITICAL' ? 0 : 1)));
    return out;
  }, [d, providers]);

  const top = useMemo(() => pickTopItem(lanes), [lanes]);
  const critCount = useMemo(
    () => Object.values(lanes).flat().filter((i) => i.severity === 'CRITICAL').length,
    [lanes],
  );
  const warnCount = useMemo(
    () => Object.values(lanes).flat().filter((i) => i.severity === 'WARNING').length,
    [lanes],
  );

  const scrollLane = (id) => () => {
    document.getElementById(`oc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) return <BoneyardSkeleton layout="dashboard" />;

  const noData = failed.length === SOURCES.length;
  const actionable = lanes.ack.length + lanes.inv.length + lanes.fix.length;
  const staleCollectors = (providers || []).filter((p) => {
    const age = ageMinutes(p.last_success_at);
    return p.status !== 'OK' || (age != null && age > STALE_MIN);
  }).length;

  return (
    <div className="ops-page page-stack">
      {failed.length > 0 && (
        <div className={`fs-banner${noData ? ' fs-banner--err' : ''}`} role={noData ? 'alert' : 'status'}>
          <AlertTriangle size={16} aria-hidden />
          <span>
            {noData ? 'Backend unreachable.' : `Partial load: ${failed.join(', ')} failed — some queue items may be missing.`}
            {lastRefresh && <> Last good load {formatISTTime(lastRefresh)}.</>}
          </span>
        </div>
      )}

      <ExceptionStrip
        ariaLabel="Action queue summary"
        items={[
          {
            id: 'ack', label: 'Acknowledgement', value: lanes.ack.length,
            sub: lanes.ack.length ? 'Needs owner' : 'Queue clear',
            tone: lanes.ack.length ? (lanes.ack.some((i) => i.severity === 'CRITICAL') ? 'critical' : 'warn') : 'ok',
            onClick: scrollLane('ack'),
            help: 'Open incidents and unowned alert groups waiting for acknowledgement.',
          },
          {
            id: 'inv', label: 'Investigation', value: lanes.inv.length,
            sub: staleCollectors ? `${staleCollectors} collectors stale` : 'Collectors OK',
            tone: lanes.inv.length ? 'warn' : 'ok',
            onClick: scrollLane('inv'),
            help: 'Degraded backends, stale collectors, or unknown health.',
          },
          {
            id: 'fix', label: 'Remediation', value: lanes.fix.length,
            sub: lanes.fix.length ? 'Routing advisories' : 'No quarantine',
            tone: lanes.fix.some((i) => i.severity === 'CRITICAL') ? 'critical' : lanes.fix.length ? 'warn' : 'ok',
            onClick: scrollLane('fix'),
            help: 'Health-engine routing recommendations (recalibrate / quarantine).',
          },
          {
            id: 'info', label: 'Informational', value: lanes.info.length,
            sub: 'Lower priority',
            tone: 'ok',
            onClick: scrollLane('info'),
            help: 'Acknowledged alerts and lower-priority context.',
          },
        ]}
      />

      <div className="oc-focus">
        <section className={`oc-focus__card oc-focus__card--priority${top?.item?.severity === 'CRITICAL' ? ' is-critical' : ''}`} aria-labelledby="oc-next-h">
          <p className="oc-focus__eyebrow" id="oc-next-h">Next up</p>
          {top ? (
            <>
              <h2 className="oc-focus__title">{top.item.title}</h2>
              <div className="oc-focus__meta">
                <span className={`badge ${sevBadge(top.item.severity)}`}>{top.item.severity || 'INFO'}</span>
                {top.item.backend && <code>{top.item.backend}</code>}
                {top.item.meta && <span>{top.item.meta}</span>}
                <span>{LANES.find((l) => l[0] === top.lane)?.[1]}</span>
              </div>
              <div className="oc-focus__actions">
                {top.item.links.map((l) => (
                  <Link key={l.label} className="qts-bean qts-bean--emphasis" to={l.to}>{l.label}</Link>
                ))}
                <button type="button" className="qts-bean" onClick={scrollLane(top.lane)}>
                  View lane <ChevronRight size={12} aria-hidden />
                </button>
              </div>
            </>
          ) : (
            <EmptyState compact variant="inline" title="Queue clear" message="Nothing waiting in acknowledgement, investigation, or remediation." />
          )}
        </section>

        <section className="oc-focus__card oc-quick" aria-label="Operator shortcuts">
          <p className="oc-focus__eyebrow">Fleet pulse</p>
          <div className="oc-pulse">
            <div className={`oc-pulse__cell${critCount ? ' oc-pulse__cell--crit' : ' oc-pulse__cell--ok'}`}>
              <span className="oc-pulse__n">{critCount}</span>
              <span className="oc-pulse__l">Critical in queue</span>
            </div>
            <div className={`oc-pulse__cell${warnCount ? ' oc-pulse__cell--warn' : ' oc-pulse__cell--ok'}`}>
              <span className="oc-pulse__n">{warnCount}</span>
              <span className="oc-pulse__l">Warnings in queue</span>
            </div>
            <div className={`oc-pulse__cell${actionable ? ' oc-pulse__cell--warn' : ' oc-pulse__cell--ok'}`}>
              <span className="oc-pulse__n">{actionable}</span>
              <span className="oc-pulse__l">Actionable total</span>
            </div>
          </div>
          <div className="oc-quick__links">
            <Link className="qts-bean" to="/app/alerts">Active alerts</Link>
            <Link className="qts-bean" to="/app/alerts/incidents">Incidents</Link>
            <Link className="qts-bean" to="/app/platform/health">Platform health</Link>
            <Link className="qts-bean" to={HEALTH_PATH}>Health vector</Link>
            <Link className="qts-bean" to="/app/execution/queues">Queues</Link>
            <Link className="qts-bean" to="/app/investigate/timeline">Timeline</Link>
          </div>
        </section>
      </div>

      {!noData && actionable === 0 && (
        <EmptyState compact variant="panel" title="Action queue empty" message="No items pending acknowledgement, investigation, or remediation." />
      )}

      <div className="oc-lanes">
        {LANES.map(([id, title, sub]) => (
          <section key={id} className={`card oc-lane oc-lane--${id}`} aria-labelledby={`oc-${id}`}>
            <header className="oc-lane__head">
              <div className="oc-lane__head-row">
                <h2 id={`oc-${id}`} className="ops-panel__title">{title}</h2>
                <span className="oc-count" data-tone={LANE_TONE[id]}>{lanes[id].length}</span>
              </div>
              <p className="ops-panel__sub">{sub}</p>
            </header>
            <div className="oc-lane__body">
              {lanes[id].length === 0 ? (
                <p className="oc-lane-empty">{LANE_EMPTY[id]}</p>
              ) : (
                <ul className="oc-list">{lanes[id].map((it) => <Row key={it.key} item={it} />)}</ul>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
