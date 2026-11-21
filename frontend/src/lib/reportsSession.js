/** Persist Reports page choices + export log across refresh (not server state). */
const STORAGE_KEY = 'qtelescope_reports_v1';
const MAX_HISTORY = 8;

export function loadReportsSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveReportsSession(patch) {
  try {
    const next = { ...loadReportsSession(), ...patch, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return patch;
  }
}

export function appendExportHistory(entry) {
  const prev = loadReportsSession();
  const history = [entry, ...(prev.exportHistory || [])].slice(0, MAX_HISTORY);
  return saveReportsSession({ exportHistory: history });
}

export const REPORT_COLUMN_LABELS = {
  alert_id: 'Alert ID',
  backend_id: 'Backend',
  resource_type: 'Resource kind',
  resource_id: 'Resource ID',
  rule_type: 'Rule / metric',
  summary: 'Operator summary',
  detected_at: 'Detected (IST)',
  backend_name: 'Backend name',
  calibration_id: 'Calibration ID',
  age_hours: 'Age (hours)',
  freshness: 'Freshness',
  timestamp: 'Snapshot (IST)',
  quantum_volume: 'Quantum volume',
};

export function reportColumnLabel(key) {
  return REPORT_COLUMN_LABELS[key] || String(key || '').replace(/_/g, ' ');
}

export function parseExportHistory(stored) {
  if (!Array.isArray(stored)) return [];
  return stored.map((h) => (h?.at ? { ...h, at: new Date(h.at) } : h)).filter((h) => h?.at && !Number.isNaN(h.at.getTime()));
}