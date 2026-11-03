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
import { buildBackendDetailsPath } from '../lib/investigationLinks.js';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { useProviderLineage, LineageBadge } from './useLineage.jsx';
import './MetricsCoverage.css';

const STATE = {
  available: { glyph: '✓', label: 'Available', help: 'At least one stored sample exists for this metric.' },
  stale: { glyph: '◔', label: 'Stale', help: 'Sample exists, but calibration is Stale (≥24 h); derived values may be outdated.' },
  missing: { glyph: '○', label: 'No sample', help: 'Adapter supports this metric; nothing stored yet.' },
  unsupported: { glyph: '—', label: 'Unsupported', help: 'Not offered for this provider/modality (excluded from coverage %).' },
};
const ORDER = ['available', 'stale', 'missing', 'unsupported'];
// scopes whose values come from the calibration snapshot
const CAL_SCOPES = new Set(['qubit', 'gate', 'edge']);

const pctText = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : 'n/a');

export const MetricsCoverage = () => {
  const nav = useNavigate();
  const lineage = useProviderLineage();
  const [registry, setRegistry] = useState([]);
  const [coverage, setCoverage] = useState(null);
  const [caps, setCaps] = useState([]);
  const [fresh, setFresh] = useState({});
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null); // { b, m }
  const [lastRefresh, setLastRefresh] = useState(null);
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
  const metricCols = useMemo(() => {
    const seen = new Map();
    (coverage || []).forEach((b) => (b.metrics || []).forEach((m) => { if (!seen.has(m.metric_id)) seen.set(m.metric_id, m); }));
    return [...seen.values()];
  }, [coverage]);

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
    return { ...c, supported, pct: pctText(c.available + c.stale, supported) };
  }, [coverage, metricCols, stateOf]);

  if (error && !coverage) return <div className="page-stack"><ErrorState variant="panel" message={error} onRetry={load} /></div>;
  if (!coverage) return <BoneyardSkeleton layout="grid" />;
  if (!coverage.length) return <EmptyState variant="panel" title="No coverage data" message="No backends have reported metric coverage yet." />;

  const cap = open && caps.find((p) => p.provider_id === open.b.provider_id);
  const openState = open && stateOf(open.b, open.m);
  const openRaw = open && (open.b.metrics || []).find((x) => x.metric_id === open.m.metric_id);

  return (
    <div className="page-stack">
      <section className="mc-kpis">
        <div className="mc-kpi"><div className="mc-kpi__label">Coverage</div><div className="mc-kpi__value">{summary.pct}</div><div className="mc-kpi__sub">{summary.available + summary.stale} of {summary.supported} supported cells have data</div></div>
        {ORDER.map((s) => (
          <div className="mc-kpi" key={s}>
            <div className="mc-kpi__label"><span aria-hidden>{STATE[s].glyph}</span> {STATE[s].label}</div>
            <div className="mc-kpi__value">{summary[s]}</div>
            <div className="mc-kpi__sub">{s === 'unsupported' ? 'excluded from %' : `${pctText(summary[s], coverage.length * metricCols.length)} of matrix`}</div>
          </div>
        ))}
      </section>

      <section className="card page-panel">
        <div className="mc-matrix-head">
          <h3 className="page-section-title" style={{ margin: 0 }}>Backend × metric</h3>
          <span className="mc-legend">{ORDER.map((s) => <span key={s} title={STATE[s].help}><i className={`mc-cell mc-cell--${s}`}>{STATE[s].glyph}</i>{STATE[s].label}</span>)}</span>
        </div>
        <div className="mc-scroll">
          <table className="mc-matrix">
            <thead>
              <tr>
                <th scope="col" className="mc-sticky">Backend</th>
                <th scope="col">Cov.</th>
                {metricCols.map((m) => <th scope="col" key={m.metric_id} title={`${m.name} (${m.unit})`}><span className="mc-colhead">{m.name}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {coverage.map((b) => {
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
                            <span aria-hidden>{STATE[s].glyph}</span>
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
            <span className="mc-state-pill__glyph" aria-hidden>{STATE[openState].glyph}</span>
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
                <DetailModalRow label="Description">{regById[open.m.metric_id]?.description || 'Not in registry.'}</DetailModalRow>
                <DetailModalRow label="Backend">{open.b.backend_id} · {(open.b.qpu_modality || 'unknown').replace('_', ' ')}</DetailModalRow>
                <DetailModalRow label="Provenance"><LineageBadge lineage={lineage?.[open.b.provider_id]} /></DetailModalRow>
                <DetailModalRow label="Calibration">{fresh[open.b.backend_id] || 'unknown'}</DetailModalRow>
                <DetailModalRow label="Provider adapter">{cap ? `${cap.provider_id}: ${cap.adapter}; ${cap.supported_metrics.includes(open.m.metric_id) ? 'declares support' : 'does not declare support'}` : 'No capability record.'}</DetailModalRow>
                <DetailModalRow label="Backend coverage">{open.b.present_count}/{open.b.supported_count} supported metrics present</DetailModalRow>
              </DetailModalDl>
              {openState === 'unsupported' && <p className="page-hint">Check modality: some metrics (e.g. frequency, gate duration) are not exposed by every adapter.</p>}
            </DetailModalSection>
            <DetailModalRelated>
              <button type="button" className="btn btn-secondary" onClick={() => nav(buildBackendDetailsPath(open.b.backend_id, 'calibration'))}>Backend calibration</button>
              <button type="button" className="btn btn-secondary" onClick={() => nav(buildBackendDetailsPath(open.b.backend_id, 'qubits'))}>Backend qubits</button>
            </DetailModalRelated>
          </DetailModalBody>
        )}
      </DetailDrawer>
    </div>
  );
};
