/**
 * Canonical product terminology — use for status chips, KPI labels, and docs.
 * See docs/audit/TERMINOLOGY.md
 */

/** Resource can be contacted / API responds */
export const AVAILABILITY = 'Reachability';

/** Within defined operational conditions (advisory, not vendor SLA) */
export const OPERATIONAL_HEALTH = 'Operational status';

/** Age since last successful telemetry ingest */
export const TELEMETRY_FRESHNESS = 'Telemetry age';

/** Calibration snapshot within freshness window */
export const CALIBRATION_FRESHNESS = 'Calibration freshness';

/** Completeness / validity of last collector cycle */
export const DATA_QUALITY = 'Ingestion quality';

/** Explicit non-measurement states */
export const NOT_AVAILABLE = 'Not available';
export const UNKNOWN = 'Unknown';
export const STALE = 'Stale';
export const NO_RECORDS = 'No records';
