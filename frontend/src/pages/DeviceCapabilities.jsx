import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { unableToLoad } from '../constants/messages.js';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { InfoTooltip } from '../components/observability/InfoTooltip.jsx';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { buildBackendDetailsPath } from '../lib/investigationLinks.js';
import './DeviceCapabilities.css';

const STATUS_TONE = {
  IDLE: 'ok',
  BUSY: 'warn',
  CALIBRATION: 'warn',
  MAINTENANCE: 'muted',
  OFFLINE: 'bad',
  ERROR: 'bad',
};

const fmt = (v, d = 2) => {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  return Math.abs(n) >= 1e4 ? n.toExponential(2) : n.toFixed(d);
};

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const DeviceCapabilities = () => {
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const { setActions, clearActions } = usePageActions();

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await api.getDeviceCapabilities({ include_jobs: true });
      setPayload(data);
      const devices = data?.devices || [];
      setSelected((prev) => {
        if (prev && devices.some((d) => d.backend_id === prev)) return prev;
        return devices[0]?.backend_id || null;
      });
    } catch (e) {
      setErr(e?.message || unableToLoad('device capabilities'));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setActions(<RefreshButton onClick={load} label="Refresh capabilities" />);
    return () => clearActions();
  }, [setActions, clearActions, load]);

  const devices = payload?.devices || [];
  const active = devices.find((d) => d.backend_id === selected) || null;
  const sheet = active?.device;
  const covered = payload?.coverage?.covered || [];
  const planned = payload?.coverage?.planned || [];

  if (loading && !payload) {
    return (
      <div className="page-stack dc-page">
        <BoneyardSkeleton layout="dashboard" />
      </div>
    );
  }

  if (err && !payload) {
    return (
      <div className="page-stack dc-page">
        <ErrorState message={err} onRetry={load} />
      </div>
    );
  }

  if (!devices.length) {
    return (
      <div className="page-stack dc-page">
        <EmptyState
          title="No fleet backends"
          message="Discover or configure providers first, then revisit device capabilities."
        />
      </div>
    );
  }

  return (
    <div className="page-stack dc-page" data-tour="page-device-capabilities">
      <header className="card dc-hero" style={{ padding: '1rem 1.15rem' }}>
        <div>
          <p className="dc-eyebrow">Resources</p>
          <h2 className="dc-title">
            Device capabilities
            <InfoTooltip label="About device capabilities">
              Tables and coupling map for each backend — no charts. Export JSON for automation,
              audits, or offline review (machine-readable snapshot of the same API payload).
            </InfoTooltip>
          </h2>
          <p className="dc-sub">
            Provider and backend metric coverage matrix · {payload?.schema || 'device-capabilities/1.0'} ·{' '}
            {devices.length} device{devices.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="dc-hero__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => downloadJson(`device-capabilities-${Date.now()}.json`, payload)}
          >
            Export JSON
          </button>
        </div>
        <p className="dc-export-hint" style={{ flexBasis: '100%', marginTop: '0.5rem' }}>
          Export downloads the full fleet payload as JSON for scripts and evidence — not an API import.
        </p>
      </header>

      <div className="dc-layout">
        <aside className="card dc-list" aria-label="Backends">
          {devices.map((d) => {
            const st = d.device?.status || '—';
            const tone = STATUS_TONE[st] || 'muted';
            return (
              <button
                key={d.backend_id}
                type="button"
                className={`dc-chip${selected === d.backend_id ? ' is-active' : ''}`}
                onClick={() => setSelected(d.backend_id)}
              >
                <span className="dc-chip__name">{d.device?.name || d.backend_id}</span>
                <span className={`dc-chip__status tone-${tone}`}>{st}</span>
                <span className="dc-chip__meta">
                  {d.device?.qubit_count ?? '—'} qubits · queue {d.device?.queue_depth ?? 0}
                </span>
              </button>
            );
          })}
        </aside>

        <section className="dc-detail" aria-live="polite">
          {!sheet ? (
            <EmptyState title="Select a device" message="Pick a backend from the list." />
          ) : (
            <>
              <div className="dc-detail__head">
                <div>
                  <h3>{sheet.name}</h3>
                  <p className="dc-mono">{active.backend_id}</p>
                </div>
                <div className="dc-detail__head-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => downloadJson(`${active.backend_id}-capabilities.json`, active)}
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate(buildBackendDetailsPath(active.backend_id))}
                  >
                    Open workspace
                  </button>
                </div>
              </div>

              <div className="dc-props">
                <div className="dc-prop">
                  <span className="dc-prop__k">Status</span>
                  <span className={`dc-prop__v tone-${STATUS_TONE[sheet.status] || 'muted'}`}>
                    {sheet.status}
                  </span>
                </div>
                <div className="dc-prop">
                  <span className="dc-prop__k">Qubits</span>
                  <span className="dc-prop__v">{sheet.qubit_count}</span>
                </div>
                <div className="dc-prop">
                  <span className="dc-prop__k">Queue depth</span>
                  <span className="dc-prop__v">{sheet.queue_depth}</span>
                </div>
                <div className="dc-prop">
                  <span className="dc-prop__k">Version</span>
                  <span className="dc-prop__v">{sheet.version}</span>
                </div>
                <div className="dc-prop">
                  <span className="dc-prop__k">Duration unit</span>
                  <span className="dc-prop__v">
                    {sheet.duration_unit} × {sheet.duration_scale}
                  </span>
                </div>
                <div className="dc-prop">
                  <span className="dc-prop__k">Reported status</span>
                  <span className="dc-prop__v">{active.telemetry?.operational_status || '—'}</span>
                </div>
              </div>

              <div className="dc-panels">
                <div className="dc-panel">
                  <h4>
                    Qubit coherence <span className="dc-count">{(sheet.qubits || []).length}</span>
                  </h4>
                  <div className="dc-table-wrap">
                    <table className="dc-table">
                      <thead>
                        <tr>
                          <th>Index</th>
                          <th>T1 (µs)</th>
                          <th>T2 (µs)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sheet.qubits || []).slice(0, 24).map((s) => (
                          <tr key={s.index}>
                            <td>{s.index}</td>
                            <td>{fmt(s.t1_us, 1)}</td>
                            <td>{fmt(s.t2_us, 1)}</td>
                          </tr>
                        ))}
                        {!sheet.qubits?.length && (
                          <tr>
                            <td colSpan={3}>No qubit telemetry</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="dc-panel">
                  <h4>
                    Gates <span className="dc-count">{(sheet.gates || []).length}</span>
                  </h4>
                  <div className="dc-table-wrap">
                    <table className="dc-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>n</th>
                          <th>Fidelity</th>
                          <th>Duration (µs)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sheet.gates || []).slice(0, 24).map((op, i) => (
                          <tr key={`${op.name}-${i}`}>
                            <td>{op.name}</td>
                            <td>{op.qubit_count ?? '—'}</td>
                            <td>{fmt(op.fidelity, 4)}</td>
                            <td>{fmt(op.duration_us, 3)}</td>
                          </tr>
                        ))}
                        {!sheet.gates?.length && (
                          <tr>
                            <td colSpan={4}>No gate telemetry</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="dc-panel dc-panel--wide">
                <h4>
                  Coupling map <span className="dc-count">{(sheet.coupling_map || []).length} edges</span>
                </h4>
                <p className="dc-coupl">
                  {(sheet.coupling_map || []).slice(0, 40).map((pair, i) => (
                    <span key={i} className="dc-edge">
                      ({pair[0]},{pair[1]})
                    </span>
                  ))}
                  {!sheet.coupling_map?.length && <span className="dc-muted">No coupling edges</span>}
                  {(sheet.coupling_map || []).length > 40 && (
                    <span className="dc-muted"> +{(sheet.coupling_map || []).length - 40} more</span>
                  )}
                </p>
              </div>
            </>
          )}
        </section>
      </div>

      <details className="dc-schema">
        <summary>API schema coverage (operator reference)</summary>
        <div className="dc-compat">
          <div>
            <h4>Included</h4>
            <ul>
              {covered.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          {planned.length > 0 && (
            <div>
              <h4>Planned (not in UI)</h4>
              <ul>
                {planned.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </div>
  );
};
