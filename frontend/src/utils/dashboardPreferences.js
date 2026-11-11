/** Dashboard grid columns + widget visibility (localStorage). */

export const DASHBOARD_GRID_KEY = 'qtelescope_dashboard_grid';
export const DASHBOARD_WIDGETS_KEY = 'qtelescope_dashboard_widgets_v2';

export const DASHBOARD_GRID_OPTIONS = [
  { id: '2', label: '2 columns' },
  { id: '3', label: '3 columns' },
  { id: '1', label: '1 column' },
];

export const WIDGET_LABELS = {
  exceptions: 'Exception strip',
  alertQueue: 'Alert triage',
  queueChart: 'Queue depth chart',
  calChart: 'Calibration age chart',
  coherenceChart: 'Coherence chart',
  modalityStrip: 'Modality strip',
  fleetSummary: 'Fleet backends',
  platformPanel: 'Platform health',
  jobFailures: 'Job failures',
  opsTimeline: 'Ops timeline',
  fleetTrend: 'Alert pressure',
};

export const WIDGET_IDS = {
  exceptions: 'exceptions',
  alertQueue: 'alertQueue',
  queueChart: 'queueChart',
  calChart: 'calChart',
  coherenceChart: 'coherenceChart',
  modalityStrip: 'modalityStrip',
  fleetSummary: 'fleetSummary',
  platformPanel: 'platformPanel',
  jobFailures: 'jobFailures',
  opsTimeline: 'opsTimeline',
  fleetTrend: 'fleetTrend',
};

const DEFAULT_WIDGETS = {
  [WIDGET_IDS.exceptions]: true,
  [WIDGET_IDS.alertQueue]: true,
  [WIDGET_IDS.queueChart]: true,
  [WIDGET_IDS.calChart]: true,
  [WIDGET_IDS.coherenceChart]: true,
  [WIDGET_IDS.fleetSummary]: false,
  [WIDGET_IDS.opsTimeline]: true,
  [WIDGET_IDS.modalityStrip]: true,
  [WIDGET_IDS.platformPanel]: true,
  [WIDGET_IDS.jobFailures]: false,
  [WIDGET_IDS.fleetTrend]: true,
};

/** @deprecated use readDashboardGrid */
export const DASHBOARD_LAYOUTS = DASHBOARD_GRID_OPTIONS.map((g) => ({
  id: g.id,
  label: g.label,
  description: 'Column layout for dashboard widgets',
}));

export function readDashboardGrid() {
  try {
    const v = localStorage.getItem(DASHBOARD_GRID_KEY);
    if (DASHBOARD_GRID_OPTIONS.some((g) => g.id === v)) return v;
    const legacy = localStorage.getItem('qtelescope_dashboard_layout');
    if (legacy === 'B' || legacy === 'C') return '3';
    if (legacy === 'A') return '2';
  } catch {
    /* ignore */
  }
  return '2';
}

export function writeDashboardGrid(id) {
  try {
    localStorage.setItem(DASHBOARD_GRID_KEY, id);
  } catch {
    /* ignore */
  }
}

/** @deprecated */
export function readDashboardLayout() {
  return readDashboardGrid();
}

/** @deprecated */
export function writeDashboardLayout(id) {
  writeDashboardGrid(id);
}

export function readDashboardWidgets(_layoutId) {
  try {
    const raw = localStorage.getItem(DASHBOARD_WIDGETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !parsed.A && !parsed.B) {
        return { ...DEFAULT_WIDGETS, ...parsed };
      }
      const legacyLayout = localStorage.getItem('qtelescope_dashboard_layout') || 'A';
      if (parsed?.[legacyLayout]) return { ...DEFAULT_WIDGETS, ...parsed[legacyLayout] };
      if (parsed && !parsed.A) return { ...DEFAULT_WIDGETS, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_WIDGETS };
}

export function writeDashboardWidgets(_layoutId, widgets) {
  try {
    localStorage.setItem(DASHBOARD_WIDGETS_KEY, JSON.stringify(widgets));
  } catch {
    /* ignore */
  }
}

export function widgetSupported(widgetId) {
  return true;
}
