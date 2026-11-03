/** Health vector metric definitions for InfoTooltip (from API field names). */

export const HEALTH_METRIC_HELP = {
  F_limit: {
    label: 'F_limit',
    body: 'Gate fidelity headroom from latest qubit telemetry. Lower values mean less margin before operational limits.',
    unit: '0–1',
  },
  eta_cal: {
    label: 'η_cal',
    body: 'Calibration quality from snapshot age and status.',
    unit: 'dimensionless',
  },
  delta_cal: {
    label: 'δ_cal',
    body: 'Calibration drift vs baseline when enough T1 history exists; otherwise insufficient history.',
    unit: 'dimensionless',
  },
  C_exec: {
    label: 'C_exec',
    body: 'Execution readiness from queue and load signals when present.',
    unit: 'dimensionless',
  },
};

export const MODULE_STATUS_KIND = {
  LIVE: 'live',
  STUB: 'mock_catalog',
  NOT_BUILT: 'not_built',
};
