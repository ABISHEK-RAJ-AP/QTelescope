import React from 'react';
import { Link } from 'react-router-dom';
import { DetailDrawer } from '../../observability/DetailDrawer.jsx';
import { formatISTTime } from '../../../utils/time';

const fmt = (v) => (v == null || v === '' ? '—' : String(v));

/** Stage detail — only fields present in API payloads. */
export function PipelineStageDrawer({ open, stageName, stageData, onClose }) {
  const body = !stageData ? (
    <p className="page-hint">No detail payload for this stage.</p>
  ) : stageName === 'Provider' && stageData.providers ? (
    <div className="viz-stage-drawer">
      <p className="page-hint">Vendor adapters from platform-health collectors block.</p>
      <table className="custom-table custom-table--dense">
        <thead>
          <tr><th>Provider</th><th>Status</th><th>Backends</th><th>Last success</th></tr>
        </thead>
        <tbody>
          {(stageData.providers || []).map((p) => (
            <tr key={p.provider_id}>
              <td><code>{p.provider_id}</code></td>
              <td>{fmt(p.status)}</td>
              <td>{fmt(p.backends_detected)}</td>
              <td>{p.last_success_at ? formatISTTime(p.last_success_at) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 12 }}>
        <Link className="fs-link" to="/app/admin/collectors">Collector run history</Link>
      </p>
    </div>
  ) : stageName === 'Collection' ? (
    <div className="viz-stage-drawer">
      <dl className="viz-metric-rows">
        <div className="viz-metric-row"><dt>Latest success</dt><dd>{stageData.latestSuccessTs ? formatISTTime(stageData.latestSuccessTs) : '—'}</dd></div>
        <div className="viz-metric-row"><dt>Stale threshold</dt><dd>{fmt(stageData.staleThresholdMin)} min</dd></div>
      </dl>
      {(stageData.executions || []).length > 0 && (
        <>
          <h4 style={{ fontSize: 13, margin: '12px 0 6px' }}>Recent executions</h4>
          <table className="custom-table custom-table--dense">
            <thead><tr><th>Provider</th><th>Status</th><th>When</th></tr></thead>
            <tbody>
              {stageData.executions.slice(0, 8).map((e) => (
                <tr key={e.execution_id || `${e.provider_id}-${e.started_at}`}>
                  <td><code>{fmt(e.provider_id)}</code></td>
                  <td>{fmt(e.status)}</td>
                  <td>{e.started_at ? formatISTTime(e.started_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p style={{ marginTop: 12 }}>
        <Link className="fs-link" to="/app/admin/collectors">Full execution log</Link>
      </p>
    </div>
  ) : stageName === 'Normalization & Persistence' && stageData.database ? (
    <dl className="viz-metric-rows">
      <div className="viz-metric-row"><dt>Reachable</dt><dd>{stageData.database.reachable == null ? '—' : stageData.database.reachable ? 'Yes' : 'No'}</dd></div>
      <div className="viz-metric-row"><dt>Storage</dt><dd>{fmt(stageData.database.storage)}</dd></div>
      {stageData.database.error && (
        <div className="viz-metric-row"><dt>Error</dt><dd>{stageData.database.error}</dd></div>
      )}
    </dl>
  ) : stageName === 'Health Evaluation' ? (
    <dl className="viz-metric-rows">
      <div className="viz-metric-row"><dt>Latest backend telemetry</dt><dd>{stageData.latestTelAt ? formatISTTime(stageData.latestTelAt) : '—'}</dd></div>
      <div className="viz-metric-row"><dt>Data platform mode</dt><dd>{fmt(stageData.dataPlatform?.platform_data_mode)}</dd></div>
      <p style={{ marginTop: 12 }}>
        <Link className="fs-link" to="/app/telemetry/health-vector">Health vector</Link>
      </p>
    </dl>
  ) : stageName === 'Alert Evaluation' ? (
  <div>
    <dl className="viz-metric-rows">
      <div className="viz-metric-row"><dt>Active alerts (dependency map)</dt><dd>{fmt(stageData.totalActiveAlerts)}</dd></div>
    </dl>
    <p style={{ marginTop: 12 }}>
      <Link className="fs-link" to="/app/alerts">Alerts</Link>
      {' · '}
      <Link className="fs-link" to="/app/incidents">Incidents</Link>
    </p>
  </div>
  ) : (
    <pre style={{ fontSize: 11, overflow: 'auto', maxHeight: 320 }}>{JSON.stringify(stageData, null, 2)}</pre>
  );

  return (
    <DetailDrawer
      open={open}
      title={stageName || 'Pipeline stage'}
      subtitle="Derived from live platform-health and collector APIs"
      onClose={onClose}
      size="md"
    >
      {body}
    </DetailDrawer>
  );
}
