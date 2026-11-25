import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { DetailDrawer } from '../components/observability/DetailDrawer.jsx';
import {
  DetailModalBody,
  DetailModalSection,
  DetailModalDl,
  DetailModalRow,
  DetailModalRelated,
} from '../components/observability/DetailModalLayout.jsx';
import { PageRelatedLink } from '../components/observability/PageRelatedNav.jsx';
import { buildBackendDetailsPath, buildDriftInvestigationLocation, buildTimelineInvestigationLocation } from '../lib/investigationLinks.js';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { Check, Circle, Clock, Minus } from 'lucide-react';
import { useProviderLineage, LineageBadge } from './useLineage.jsx';
import './MetricsCoverage.css';

const STATE = {
  available: { Icon: Check, label: 'Available', help: 'At least one stored sample exists for this metric.' },
  stale: { Icon: Clock, label: 'Stale', help: 'Sample exists, but calibration is Stale (24 h or older). Derived values may be outdated.' },
  missing: { Icon: Circle, label: 'No sample', help: 'This adapter supports the metric. Nothing is stored yet.' },
  unsupported: { Icon: Minus, label: 'Unsupported', help: 'Not offered for this provider or modality. Excluded from coverage.' },
};

function StateMark({ id }) {
  const Icon = STATE[id].Icon;
  return <Icon size={14} aria-hidden />;
}
const ORDER = ['available', 'stale', 'missing', 'unsupported'];

const METRIC_ABBR = {
  t1_us: 'T1',
  t2_us: 'T2',
  t2_echo_us: 'T2ε',
  readout_error: 'RO',
  frequency_ghz: 'Freq',
  gate_error_1q: '1Q',
  gate_error_2q: '2Q',
  gate_duration_ns: 'Dur',
  queue_pending: 'Queue',
  queue_wait_s: 'Wait',
  calibration_timestamp: 'Cal',
  topology_edges: 'Topo',
  job_status: 'Jobs',
};
// scopes whose values come from the calibration snapshot
const CAL_SCOPES = new Set(['qubit', 'gate', 'edge']);

const pctText = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : 'n/a');

export const MetricsCoverage = () => {
  const nav = useNavigate();
  const lineage = useProviderLineage();
  const [registry, setRegistry] = useState([]);
  const [metricGroups, setMetricGroups] = useState([]);
  const [coverage, setCoverage] = useState(null);
  const [caps, setCaps] = useState([]);
  const [fresh, setFresh] = useState({});
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null); // { b, m }
  const [lastRefresh, setLastRefresh] = useState(null);
  const [backendQuery, setBackendQuery] = useState('');
  const { setActions, clearActions } = usePageActions();

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      api.getMetricRegistry().catch(() => ({ metrics: [] })),
      api.getMetricCapabilities().catch(() => ({ providers: [] })),
      api.getMetricCoverage(),
      api.getCalibrations().catch(() => []),
    ]).then(([reg, cap, cov, calList]) => {
      setRegistry(reg.metrics || []);
      setMetricGroups(reg.groups || []);
      setCaps(cap.providers || []);
      setCoverage(cov.backends || []);
      setFresh(Object.fromEntries((calList || []).map((c) => [c.backend_id, c.freshness_status])));
      setLastRefresh(new Date());
    }).catch((e) => setError(String(e.message || e)));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh metrics" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  const regById = useMemo(() => Object.fromEntries(registry.map((m) => [m.metric_id, m])), [registry]);
  const groupLabel = useMemo(
    () => Object.fromEntries((metricGroups || []).map((g) => [g.id, g.label])),
    [metricGroups],
  );

  const metricCols = useMemo(() => {
    const seen = new Map();
    (coverage || []).forEach((b) => (b.metrics || []).forEach((m) => { if (!seen.has(m.metric_id)) seen.set(m.metric_id, m); }));
    const order = (metricGroups || []).flatMap((g) => g.metric_ids || []);
    const rows = [...seen.values()];
    if (!order.length) return rows;
    const rank = new Map(order.map((id, i) => [id, i]));
    return rows.toSorted((a, b) => (rank.get(a.metric_id) ?? 999) - (rank.get(b.metric_id) ?? 999));
  }, [coverage, metricGroups]);

  const stateOf = useCallback((b, m) => {
    const raw = (b.metrics || []).find((x) => x.metric_id === m.metric_id);
    if (!raw) return 'unsupported';
    if (raw.state === 'present') return fresh[b.backend_id] === 'Stale' && CAL_SCOPES.has(raw.scope) ? 'stale' : 'available';
    return raw.state === 'missing' ? 'missing' : 'unsupported';
  }, [fresh]);

  const summary = useMemo(() => {
    const c = { available: 0, stale: 0, missing: 0, unsupported: 0 };
    (coverage || []).forEach((b) => metricCols.forEach((m) => { c[stateOf(b, m)] += 1; }));
    const supported = c.available + c.stale + c.missing;
    const totalCells = supported + c.unsupported;
    return {
      ...c,
      supported,
      totalCells,
      pct: pctText(c.available + c.stale, supported),
      samplePct: pctText(c.available, supported),
    };
  }, [coverage, metricCols, stateOf]);

  const fleetFindings = useMemo(() => {
    const items = [];
    metricCols.forEach((m) => {
      let withSample = 0;
      let eligible = 0;
      (coverage || []).forEach((b) => {
        const st = stateOf(b, m);
        if (st === 'unsupported') return;
        eligible += 1;
        if (st === 'available' || st === 'stale') withSample += 1;
      });
      if (eligible > 0 && withSample === 0) {
        items.push({ kind: 'fleet_gap', metric: m, eligible });
      }
    });
  const rows = (coverage || []).map((b) => {
      const sup = b.supported_count || 0;
      const pct = sup ? (b.present_count ?? 0) / sup : 0;
      return { b, pct, sup };
    }).sort((a, b) => a.pct - b.pct);
    if (rows[0] && rows[0].pct < 0.75) {
      items.push({ kind: 'low_backend', row: rows[0] });
    }
    return items;
  }, [coverage, metricCols, stateOf]);

  const filteredCoverage = useMemo(() => {
    const q = backendQuery.trim().toLowerCase();
    if (!q) return coverage;
    return coverage.filter((b) => (
      (b.backend_name || '').toLowerCase().includes(q)
      || (b.backend_id || '').toLowerCase().includes(q)
      || (b.provider_id || '').toLowerCase().includes(q)
    ));
  }, [coverage, backendQuery]);

  if (error && !coverage) return <div className="page-stack"><ErrorState variant="panel" message={error} onRetry={load} /></div>;
  if (!coverage) return <BoneyardSkeleton layout="grid" />;
  if (!coverage.length) return <EmptyState variant="panel" title="No coverage data" message="No backends have reported metric coverage yet." />;

  const cap = open && caps.find((p) => p.provider_id === open.b.provider_id);
  const openState = open && stateOf(open.b, open.m);
  const openRaw = open && (open.b.metrics || []).find((x) => x.metric_id === open.m.metric_id);

  return (
    <div className="page-stack">
      <section className="mc-kpis">
        <div className="mc-kpi"><div className="mc-kpi__label">Supported metric coverage</div><div className="mc-kpi__value">{summary.pct}</div><div className="mc-kpi__sub">{summary.available + summary.stale} of {summary.supported} supported combinations have samples · {summary.unsupported} unsupported (excluded)</div></div>
        {ORDER.map((s) => (
          <div className="mc-kpi" key={s}>
            <div className="mc-kpi__label"><StateMark id={s} /> {STATE[s].label}</div>
            <div className="mc-kpi__value">{summary[s]}</div>
            <div className="mc-kpi__sub">{s === 'unsupported' ? `${summary.unsupported} of ${summary.totalCells} total cells` : s === 'available' ? `${pctText(summary.available, summary.supported)} of supported` : s === 'missing' ? `${pctText(summary.missing, summary.supported)} of supported` : `${pctText(summary.stale, summary.supported)} of supported`}</div>
          </div>
        ))}
      </section>

      <section className="card page-panel">
        <div className="mc-matrix-head">
          <h3 className="page-section-title" style={{ margin: 0 }}>Backend × metric</h3>
          <span className="mc-legend">{ORDER.map((s) => <span key={s} title={STATE[s].help}><i className={`mc-cell mc-cell--${s}`}><StateMark id={s} /></i>{STATE[s].label}</span>)}</span>
        </div>
        <div className="mc-toolbar">
          <label className="mc-search">
            <span className="sr-only">Search backends</span>
            <input type="search" value={backendQuery} onChange={(e) => setBackendQuery(e.target.value)} placeholder="Search backends" />
          </label>
          <button type="button" className="btn btn-secondary btn--sm" onClick={() => api.downloadMetricCoverageCsv().catch((e) => setError(String(e.message || e)))}>
            Export CSV
          </button>
          {lastRefresh ? <span className="page-hint" style={{ margin: 0 }}>Evaluated {lastRefresh.toLocaleString()}</span> : null}
        </div>
        {metricGroups.length > 0 ? (
          <p className="page-hint mc-groups" style={{ margin: '0 0 12px' }}>
            Metric groups: {metricGroups.map((g) => `${g.label} (${(g.metric_ids || []).length})`).join(' · ')}
          </p>
        ) : null}
        {fleetFindings.length > 0 && (
          <div className="mc-findings" role="status">
            <strong>Coverage findings</strong>
            <ul>
              {fleetFindings.filter((f) => f.kind === 'fleet_gap').map((f) => (
                <li key={f.metric.metric_id}>{f.metric.name}: no samples on {f.eligible} eligible backend{f.eligible === 1 ? '' : 's'}.</li>
              ))}
              {fleetFindings.filter((f) => f.kind === 'low_backend').map((f) => (
                <li key={f.row.b.backend_id}>{f.row.b.backend_name || f.row.b.backend_id}: lowest supported coverage ({pctText(f.row.b.present_count ?? 0, f.row.sup)}).</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mc-scroll">
          <table className="mc-matrix">
            <thead>
              <tr>
                <th scope="col" className="mc-sticky">Backend</th>
                <th scope="col" title="Supported metrics with stored samples">Cov.</th>
                {metricCols.map((m) => (
                  <th
                    scope="col"
                    key={m.metric_id}
                    title={`${m.name} (${m.unit})${m.group ? ` · ${groupLabel[m.group] || m.group}` : ''}`}
                  >
                    <span className="mc-colhead">{METRIC_ABBR[m.metric_id] || m.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCoverage.map((b) => {
                const sup = (b.supported_count ?? 0);
                return (
                  <tr key={b.backend_id}>
                    <th scope="row" className="mc-sticky">
                      <div className="mc-bname">{b.backend_name || b.backend_id}</div>
                      <div className="mc-bmeta">{(b.qpu_modality || 'unknown').replace('_', ' ')} <LineageBadge lineage={lineage?.[b.provider_id]} /></div>
                    </th>
                    <td className="mc-pct">{pctText(b.present_count ?? 0, sup)}</td>
                    {metricCols.map((m) => {
                      const s = stateOf(b, m);
                      return (
                        <td key={m.metric_id}>
                          <button type="button" className={`mc-cell mc-cell--${s}`} onClick={() => setOpen({ b, m })}
                            aria-label={`${b.backend_name || b.backend_id}, ${m.name}: ${STATE[s].label}`} title={`${m.name}: ${STATE[s].label}`}>
                            <StateMark id={s} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {Object.keys(fresh).length === 0 && (
          <p className="page-hint" style={{ marginTop: 8 }}>Calibration freshness unavailable — stale cells not computed.</p>
        )}
      </section>

      <DetailDrawer
        open={!!open}
        title={open ? open.m.name : ''}
        subtitle={open ? (open.b.backend_name || open.b.backend_id) : undefined}
        headerAside={open ? (
          <span className={`mc-state-pill mc-state-pill--${openState}`} title={STATE[openState].help}>
            <span className="mc-state-pill__glyph" aria-hidden><StateMark id={openState} /></span>
            <span className="mc-state-pill__label">{STATE[openState].label}</span>
          </span>
        ) : null}
        size="lg"
        onClose={() => setOpen(null)}
      >
        {open && (
          <DetailModalBody>
            <DetailModalSection title="Coverage status">
              <p className="page-hint">{STATE[openState].help}</p>
            </DetailModalSection>
            <DetailModalSection title="Details">
              <DetailModalDl>
                <DetailModalRow label="Metric"><code>{open.m.metric_id}</code> · {open.m.unit} · scope {openRaw?.scope || open.m.scope}</DetailModalRow>
                <DetailModalRow label="Group">{groupLabel[regById[open.m.metric_id]?.group] || regById[open.m.metric_id]?.group || '—'}</DetailModalRow>
                <DetailModalRow label="Description">{regById[open.m.metric_id]?.description || 'Not in registry.'}</DetailModalRow>
                <DetailModalRow label="Backend">{open.b.backend_id} · {(open.b.qpu_modality || 'unknown').replace('_', ' ')}</DetailModalRow>
                {lineage?.[open.b.provider_id] === 'live' && (
                  <DetailModalRow label="Provenance"><LineageBadge lineage="live" /></DetailModalRow>
                )}
                <DetailModalRow label="Calibration">{fresh[open.b.backend_id] || 'unknown'}</DetailModalRow>
                <DetailModalRow label="Adapter mode">{cap ? `${cap.adapter === 'live' ? 'Live connection' : 'Stub'} · ${cap.provider_id}` : 'No capability record.'}</DetailModalRow>
                <DetailModalRow label="Metric support">{cap ? (cap.supported_metrics.includes(open.m.metric_id) ? 'Declared by capability matrix' : 'Not declared for this provider') : '—'}</DetailModalRow>
                <DetailModalRow label="Data origin">{lineage?.[open.b.provider_id] === 'live' ? 'Live ingest path' : 'Demonstration or synthetic catalog'}</DetailModalRow>
                <DetailModalRow label="Backend coverage">{open.b.present_count}/{open.b.supported_count} supported metrics present</DetailModalRow>
              </DetailModalDl>
              {openState === 'unsupported' && <p className="page-hint">Check modality: some metrics (e.g. frequency, gate duration) are not exposed by every adapter.</p>}
            </DetailModalSection>
            <DetailModalSection title="Workspace">
              <button type="button" className="btn btn-primary" onClick={() => nav(buildBackendDetailsPath(open.b.backend_id, 'telemetry'))}>Open backend workspace</button>
            </DetailModalSection>
            <DetailModalRelated>
              <PageRelatedLink onClick={() => nav(`/app/telemetry/explorer?backend=${encodeURIComponent(open.b.backend_id)}&metric=${encodeURIComponent(open.m.metric_id)}`)}>Metrics explorer</PageRelatedLink>
              <PageRelatedLink onClick={() => nav(buildTimelineInvestigationLocation({ backendId: open.b.backend_id }))}>Ops timeline</PageRelatedLink>
              <PageRelatedLink onClick={() => nav(buildDriftInvestigationLocation({ backendId: open.b.backend_id }))}>Drift analysis</PageRelatedLink>
            </DetailModalRelated>
          </DetailModalBody>
        )}
      </DetailDrawer>
    </div>
  );
};
