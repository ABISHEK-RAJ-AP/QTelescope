/**
 * PipelineVisualizer
 * ------------------
 * Shows the monitoring pipeline stages derived from REAL collector-health API data.
 *
 * Pipeline:  Provider → Collection → Normalization/Persistence → Health Eval → Alert Eval
 *
 * Props:
 *   platformData         — response from api.getPlatformHealth() — already loaded by parent
 *   collectorExecutions  — array from api.getCollectorExecutions()
 *   onStageClick         — (stageName, stageData) => void
 *   className            — optional CSS class additions
 */

import React, { useMemo } from 'react';
import {
  Clock,
  Database,
  Cpu,
  Bell,
  Shield,
  Server,
  ArrowRight,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  XCircle,
} from 'lucide-react';
import { FreshnessLabel } from '../shared/FreshnessLabel.jsx';
import '../shared/visualizations.css';
import './pipeline.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normalise a timestamp string so it always has a timezone indicator. */
const normaliseTs = (s) =>
  s && !/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? `${s}Z` : s;

/** Minutes elapsed since a timestamp. Returns null if unavailable. */
const ageMin = (ts) => {
  if (!ts) return null;
  const d = new Date(normaliseTs(ts));
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / 60_000;
};

/** Terse human-readable elapsed time. */
const ageText = (m) => {
  if (m == null || !Number.isFinite(m)) return '—';
  if (m < 1) return 'just now';
  if (m < 90) return `${Math.round(m)} min ago`;
  return m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

const STALE_MINUTES = 30;

/**
 * Maps a canonical status string → CSS modifier for viz-stage.
 * Valid modifiers: healthy | warn | critical | unknown
 */
function statusToModifier(status) {
  if (!status) return 'unknown';
  switch (status) {
    case 'healthy': return 'healthy';
    case 'degraded': return 'warn';
    case 'failed':   return 'critical';
    default:         return 'unknown';
  }
}

/**
 * Maps a canonical status string → badge class.
 */
function statusToBadge(status) {
  if (!status) return '';
  switch (status) {
    case 'healthy': return 'badge-healthy';
    case 'degraded': return 'badge-warning';
    case 'failed':   return 'badge-critical';
    default:         return '';
  }
}

/**
 * Maps a canonical status string → label.
 */
function statusToLabel(status) {
  switch (status) {
    case 'healthy': return 'Healthy';
    case 'degraded': return 'Degraded';
    case 'failed':   return 'Failed';
    case 'no-data':  return 'No data';
    default:         return 'Unknown';
  }
}

/**
 * Maps a canonical status string → Lucide icon.
 */
function StatusIcon({ status, size = 13 }) {
  const props = { size, strokeWidth: 2, 'aria-hidden': true };
  switch (status) {
    case 'healthy':  return <CheckCircle2 {...props} style={{ color: 'var(--ds-status-healthy)' }} />;
    case 'degraded': return <AlertTriangle {...props} style={{ color: 'var(--ds-status-warn)' }} />;
    case 'failed':   return <XCircle {...props} style={{ color: 'var(--ds-status-critical)' }} />;
    default:         return <HelpCircle {...props} style={{ color: 'var(--ds-status-unknown)' }} />;
  }
}

// ─── Stage derivation from real data ────────────────────────────────────────

/**
 * Builds the five pipeline stage descriptors from live API data.
 *
 * Returns an array of:
 *   { id, name, icon: LucideComponent, status, metric, freshnessTsIso, stageData }
 */
function deriveStages(platformData, collectorExecutions) {
  const collectors = platformData?.collectors || {};
  const providers   = collectors.providers || [];
  const database    = platformData?.database || {};
  const execs       = Array.isArray(collectorExecutions) ? collectorExecutions : [];

  // Aggregate last_success_at across all providers
  const latestSuccessTs = providers.reduce((best, p) => {
    const ts = p.last_success_at || p.last_run_at;
    if (!ts) return best;
    if (!best) return ts;
    return new Date(normaliseTs(ts)) > new Date(normaliseTs(best)) ? ts : best;
  }, null);

  const anyProviderFailed = providers.some((p) => p.status !== 'OK' || p.error);
  const failedCount = collectors.failed_count ?? providers.filter((p) => p.status !== 'OK').length;

  // ── Stage 1: Provider ────────────────────────────────────────────────────
  let providerStatus;
  if (!providers.length) {
    providerStatus = 'unknown';
  } else if (failedCount > 0 || anyProviderFailed) {
    providerStatus = 'failed';
  } else {
    providerStatus = 'healthy';
  }

  const providerMetric = providers.length
    ? `${providers.length - failedCount}/${providers.length} OK`
    : '—';

  // ── Stage 2: Collection ──────────────────────────────────────────────────
  let collectionStatus;
  const collAgeMin = ageMin(latestSuccessTs);
  if (!latestSuccessTs) {
    collectionStatus = 'unknown';
  } else if (anyProviderFailed) {
    collectionStatus = 'failed';
  } else if (collAgeMin != null && collAgeMin > STALE_MINUTES) {
    collectionStatus = 'degraded';
  } else {
    collectionStatus = 'healthy';
  }

  const collectionMetric = latestSuccessTs ? ageText(collAgeMin) : '—';

  // ── Stage 3: Normalization / Persistence (derives from DB reachability) ──
  let persistenceStatus;
  if (database.reachable == null) {
    persistenceStatus = 'unknown';
  } else {
    persistenceStatus = database.reachable ? 'healthy' : 'failed';
  }

  const dbMetric = database.reachable != null
    ? (database.reachable ? `Reachable · ${database.storage || '—'}` : `Unreachable${database.error ? ` · ${database.error}` : ''}`)
    : '—';

  // ── Stage 4: Health Evaluation ───────────────────────────────────────────
  // Derived from platform data's data_platform mode / latest telemetry presence
  const latestTelAt = platformData?.latest_backend_telemetry_at;
  const telAgeMin   = ageMin(latestTelAt);

  let healthEvalStatus;
  if (!platformData) {
    healthEvalStatus = 'unknown';
  } else if (!latestTelAt) {
    healthEvalStatus = 'unknown';
  } else if (telAgeMin != null && telAgeMin > 60) {
    healthEvalStatus = 'degraded';
  } else {
    healthEvalStatus = 'healthy';
  }

  const healthEvalMetric = latestTelAt ? ageText(telAgeMin) : '—';

  // ── Stage 5: Alert Evaluation ────────────────────────────────────────────
  // Derive from dependency_links active alert counts
  const depLinks = platformData?.dependency_links || [];
  const totalActive = depLinks.reduce((sum, dl) => {
    return sum + (dl.backends || []).reduce((s, b) => s + (b.active_alerts || 0), 0);
  }, 0);

  let alertEvalStatus;
  if (!platformData) {
    alertEvalStatus = 'unknown';
  } else if (!persistenceStatus || persistenceStatus === 'failed') {
    // If persistence is broken, alert eval can't run reliably
    alertEvalStatus = 'failed';
  } else if (persistenceStatus === 'unknown') {
    alertEvalStatus = 'unknown';
  } else {
    alertEvalStatus = 'healthy';
  }

  const alertEvalMetric = platformData
    ? (depLinks.length ? `${totalActive} active alert${totalActive !== 1 ? 's' : ''}` : '—')
    : '—';

  // Most-recent execution record for the drawer
  const lastExec = execs.length ? execs[0] : null;

  return [
    {
      id:            'provider',
      name:          'Provider',
      description:   'Vendor adapter fetches raw quantum data',
      icon:          Server,
      status:        providerStatus,
      metric:        providerMetric,
      freshnessTsIso: latestSuccessTs || null,
      stageData: {
        providers,
        failedCount,
        latestSuccessTs,
        executions: execs.filter((e) => !e.provider_id || providers.some((p) => p.provider_id === e.provider_id)),
      },
    },
    {
      id:            'collection',
      name:          'Collection',
      description:   'Scheduled runs fetch & buffer raw telemetry',
      icon:          Clock,
      status:        collectionStatus,
      metric:        collectionMetric,
      freshnessTsIso: latestSuccessTs || null,
      stageData: {
        latestSuccessTs,
        ageMin: collAgeMin,
        staleThresholdMin: STALE_MINUTES,
        executions: execs.slice(0, 10),
        lastExec,
      },
    },
    {
      id:            'persistence',
      name:          'Normalization & Persistence',
      description:   'Records normalised to schema and written to store',
      icon:          Database,
      status:        persistenceStatus,
      metric:        dbMetric,
      freshnessTsIso: null,
      stageData: {
        database,
        dbMetric,
      },
    },
    {
      id:            'health-eval',
      name:          'Health Evaluation',
      description:   'Per-qubit health scores computed from telemetry',
      icon:          Cpu,
      status:        healthEvalStatus,
      metric:        healthEvalMetric,
      freshnessTsIso: latestTelAt || null,
      stageData: {
        latestTelAt,
        ageMin: telAgeMin,
        dataPlatform: platformData?.data_platform || null,
      },
    },
    {
      id:            'alert-eval',
      name:          'Alert Evaluation',
      description:   'Alert rules applied to health scores, incidents raised',
      icon:          Bell,
      status:        alertEvalStatus,
      metric:        alertEvalMetric,
      freshnessTsIso: null,
      stageData: {
        totalActiveAlerts: totalActive,
        depLinks,
      },
    },
  ];
}

// ─── Stage Card ──────────────────────────────────────────────────────────────

function StageCard({ stage, onStageClick, index }) {
  const { id, name, description, icon: Icon, status, metric, freshnessTsIso, stageData } = stage;
  const modifier  = statusToModifier(status);
  const badge     = statusToBadge(status);
  const label     = statusToLabel(status);

  const handleClick = () => onStageClick?.(name, stageData);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <button
      type="button"
      className={`viz-stage viz-stage--${modifier} viz-pipeline__stage-btn`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Pipeline stage ${index + 1}: ${name} — status: ${label}${metric && metric !== '—' ? `, ${metric}` : ''}`}
      tabIndex={0}
    >
      {/* Stage number + icon row */}
      <div className="viz-pipeline__stage-header">
        <span className="viz-pipeline__stage-num" aria-hidden="true">{index + 1}</span>
        <Icon size={16} strokeWidth={1.8} aria-hidden="true" className="viz-pipeline__stage-icon" />
      </div>

      {/* Name */}
      <div className="viz-stage__label">{name}</div>

      {/* Status badge */}
      <div className="viz-pipeline__stage-badge">
        <StatusIcon status={status} />
        <span className={`badge ${badge || ''} viz-pipeline__stage-status`}>{label}</span>
      </div>

      {/* Key metric */}
      {metric && metric !== '—' && (
        <div className="viz-stage__meta viz-pipeline__stage-metric">{metric}</div>
      )}

      {/* Freshness label (only when meaningful) */}
      {freshnessTsIso && (
        <FreshnessLabel asOf={freshnessTsIso} staleMinutes={STALE_MINUTES} showIcon={false} />
      )}
    </button>
  );
}

// ─── Fallback table ───────────────────────────────────────────────────────────

function PipelineFallbackTable({ stages }) {
  return (
    <table className="custom-table custom-table--dense viz-pipeline__table" aria-label="Pipeline stages">
      <thead>
        <tr>
          <th>#</th>
          <th>Stage</th>
          <th>Status</th>
          <th>Metric</th>
        </tr>
      </thead>
      <tbody>
        {stages.map((s, i) => (
          <tr key={s.id}>
            <td>{i + 1}</td>
            <td>
              <strong>{s.name}</strong>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{s.description}</div>
            </td>
            <td>
              <span className={`badge ${statusToBadge(s.status) || ''}`}>{statusToLabel(s.status)}</span>
            </td>
            <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              {s.metric || '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * PipelineVisualizer
 *
 * Props:
 *   platformData         — response from api.getPlatformHealth()
 *   collectorExecutions  — array from api.getCollectorExecutions()
 *   onStageClick         — (stageName, stageData) => void
 *   className            — optional CSS class additions
 */
export function PipelineVisualizer({ platformData, collectorExecutions, onStageClick, className = '' }) {
  const stages = useMemo(
    () => deriveStages(platformData, collectorExecutions),
    [platformData, collectorExecutions],
  );

  return (
    <div className={`viz-pipeline-wrapper ${className}`}>
      {/* Illustration disclaimer */}
      <p className="viz-pipeline__disclaimer page-hint" role="note">
        <Shield size={12} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 4 }} />
        Illustrative pipeline — not all stages are individually instrumented. Status is derived
        from collector-health API data. Click a stage for details.
      </p>

      {/* Horizontal scrollable pipeline on desktop; vertical on mobile */}
      <div
        className="viz-pipeline viz-pipeline--interactive"
        role="list"
        aria-label="Monitoring pipeline stages"
      >
        {stages.map((stage, i) => (
          <React.Fragment key={stage.id}>
            {/* Stage card */}
            <div role="listitem">
              <StageCard
                stage={stage}
                onStageClick={onStageClick}
                index={i}
              />
            </div>

            {/* Connector arrow (not after last stage) */}
            {i < stages.length - 1 && (
              <div className="viz-pipeline__connector" aria-hidden="true">
                <ArrowRight size={16} strokeWidth={1.5} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Accessible fallback table (always rendered, visually hidden on wide screens) */}
      <div className="viz-pipeline__table-wrapper" aria-label="Pipeline status table">
        <PipelineFallbackTable stages={stages} />
      </div>
    </div>
  );
}
