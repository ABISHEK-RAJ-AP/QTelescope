const STORAGE_PREFIX = 'govern-overview-widgets-v1';

/** @type {import('../components/ui/draggable-widget-grid-layout.js').WidgetItem[]} */
export const DEFAULT_WIDGETS = [
  { id: 'kpis', size: 'wide', label: 'Operational summary' },
  { id: 'queue', size: 'wide', label: 'Needs review' },
  { id: 'actions', size: 'tall', label: 'Action centre' },
  { id: 'admission', size: 'wide', label: 'Admission mix' },
  { id: 'quota', size: 'sm', label: 'Shot quota' },
  { id: 'activity', size: 'wide', label: 'Recent activity' },
];

export function widgetsForLens(lens, { showAdmissionMix, showQuota, activityFirst }) {
  let list = DEFAULT_WIDGETS.filter((w) => {
    if (w.id === 'admission' && !showAdmissionMix) return false;
    if (w.id === 'quota' && !showQuota) return false;
    if (w.id === 'activity' && activityFirst) return false;
    if (lens === 'viewer' && w.id === 'actions') return false;
    return true;
  });
  if (activityFirst) {
    list = list.filter((w) => w.id !== 'activity');
  }
  return list;
}

export function readWidgetLayout(lens) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${lens}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((w) => w?.id && w?.size);
  } catch {
    return null;
  }
}

export function writeWidgetLayout(lens, items) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${lens}`, JSON.stringify(items));
  } catch {
    /* quota / private mode */
  }
}

export function mergeSavedOrder(defaults, saved) {
  if (!saved?.length) return defaults;
  const byId = new Map(defaults.map((d) => [d.id, d]));
  const ordered = [];
  for (const s of saved) {
    const base = byId.get(s.id);
    if (!base) continue;
    ordered.push({ ...base, size: s.size || base.size });
    byId.delete(s.id);
  }
  for (const rest of byId.values()) ordered.push(rest);
  return ordered;
}