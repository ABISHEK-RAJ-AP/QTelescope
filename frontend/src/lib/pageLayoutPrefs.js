/** Dashboard bento layout (Cert Studio pageLayoutPrefs pattern, localStorage only). */

import { WIDGET_IDS } from '../utils/dashboardPreferences.js';

const LAYOUT_PREFS_KEY = 'qtelescope_page_layouts';
export const LAYOUT_PREFS_EVENT = 'qtelescope:page-layouts';

export const DASHBOARD_PAGE_DEFAULT = {
  pageId: 'dashboard',
  version: 4,
  widgets: [
    { id: WIDGET_IDS.fleetTrend, span: 'full' },
    { id: WIDGET_IDS.queueChart, span: 'medium' },
    { id: WIDGET_IDS.calChart, span: 'medium' },
    { id: WIDGET_IDS.coherenceChart, span: 'medium' },
    { id: WIDGET_IDS.modalityStrip, span: 'medium' },
    { id: WIDGET_IDS.platformPanel, span: 'full' },
    { id: WIDGET_IDS.fleetSummary, span: 'full' },
    { id: WIDGET_IDS.opsTimeline, span: 'full' },
  ],
};

const PAGE_DEFAULTS = {
  dashboard: DASHBOARD_PAGE_DEFAULT,
};

function normalizeWidget(w, fallbackSpan = 'medium') {
  if (!w || typeof w !== 'object') return null;
  const id = String(w.id || '').trim();
  if (!id) return null;
  let span = ['wide', 'medium', 'compact', 'full'].includes(w.span) ? w.span : fallbackSpan;
  if (span === 'wide') span = 'medium';
  return { id, span };
}

export function equalizeMatrixSpans(widgets) {
  if (!Array.isArray(widgets) || !widgets.length) return [];

  const remapped = widgets.map((w) => normalizeWidget(w)).filter(Boolean);
  const out = [];
  let row = [];
  let used = 0;

  const flushRow = () => {
    if (!row.length) return;
    const n = row.length;
    const span = n === 1 ? 'full' : n === 2 ? 'medium' : 'compact';
    for (const w of row) out.push({ id: w.id, span });
    row = [];
    used = 0;
  };

  for (const w of remapped) {
    if (w.span === 'full') {
      flushRow();
      out.push({ id: w.id, span: 'full' });
      continue;
    }
    const cols = w.span === 'compact' ? 4 : 6;
    if (used > 0 && used + cols > 12) flushRow();
    row.push(w);
    used += cols;
    if (used >= 12) flushRow();
  }
  flushRow();
  return out;
}

function normalizePageLayout(pageId, raw) {
  const fallback = PAGE_DEFAULTS[pageId] || { pageId, version: 1, widgets: [] };
  const fallbackVersion = Number(fallback.version) || 1;
  if (!raw || typeof raw !== 'object') {
    return { pageId, version: fallbackVersion, widgets: fallback.widgets.map((w) => normalizeWidget(w)).filter(Boolean) };
  }
  if (Number(raw.version) < fallbackVersion) {
    return { pageId, version: fallbackVersion, widgets: fallback.widgets.map((w) => normalizeWidget(w)).filter(Boolean) };
  }

  const allowedIds = new Set(fallback.widgets.map((w) => w.id));
  const incoming = Array.isArray(raw.widgets) ? raw.widgets : [];
  const seen = new Set();
  const widgets = [];

  for (const item of incoming) {
    const w = normalizeWidget(item);
    if (!w || !allowedIds.has(w.id) || seen.has(w.id)) continue;
    seen.add(w.id);
    widgets.push(w);
  }
  for (const def of fallback.widgets) {
    if (!seen.has(def.id)) widgets.push({ ...normalizeWidget(def) });
  }

  return { pageId, version: fallbackVersion, widgets: widgets.map((w) => normalizeWidget(w)).filter(Boolean) };
}

export function readPageLayout(pageId) {
  if (typeof window === 'undefined') {
    return normalizePageLayout(pageId, PAGE_DEFAULTS[pageId]);
  }
  try {
    const raw = localStorage.getItem(LAYOUT_PREFS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return normalizePageLayout(pageId, all[pageId]);
  } catch {
    return normalizePageLayout(pageId, PAGE_DEFAULTS[pageId]);
  }
}

export function writePageLayout(pageId, layout) {
  const normalized = normalizePageLayout(pageId, layout);
  if (typeof window === 'undefined') return normalized;
  try {
    const raw = localStorage.getItem(LAYOUT_PREFS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[pageId] = normalized;
    localStorage.setItem(LAYOUT_PREFS_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent(LAYOUT_PREFS_EVENT, { detail: { pageId, layout: normalized } }));
  } catch {
    /* ignore */
  }
  return normalized;
}

export function resetPageLayout(pageId) {
  const fallback = PAGE_DEFAULTS[pageId];
  if (!fallback) return null;
  if (typeof window === 'undefined') {
    return { ...fallback, widgets: fallback.widgets.map((w) => normalizeWidget(w)).filter(Boolean) };
  }

  try {
    const raw = localStorage.getItem(LAYOUT_PREFS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    delete all[pageId];
    localStorage.setItem(LAYOUT_PREFS_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent(LAYOUT_PREFS_EVENT, { detail: { pageId } }));
  } catch {
    /* ignore */
  }
  return normalizePageLayout(pageId, fallback);
}

export function subscribePageLayouts(listener) {
  if (typeof window === 'undefined') return () => {};
  const onCustom = (e) => listener(e.detail);
  window.addEventListener(LAYOUT_PREFS_EVENT, onCustom);
  return () => window.removeEventListener(LAYOUT_PREFS_EVENT, onCustom);
}

const SPAN_COLUMNS = { compact: 4, medium: 6, wide: 6, full: 12 };

function spanColumns(span) {
  return SPAN_COLUMNS[span] ?? 6;
}

export function suggestLayoutGaps(_pageId, layout) {
  const widgets = equalizeMatrixSpans(layout?.widgets || []);
  const suggestions = [];
  let rowUsed = 0;

  for (const widget of widgets) {
    const cols = spanColumns(widget.span);
    if (rowUsed > 0 && rowUsed + cols > 12) rowUsed = 0;
    if (rowUsed > 0 && rowUsed + cols < 12) {
      const gap = 12 - rowUsed - cols;
      if (gap >= 3) {
        suggestions.push({
          widgetId: widget.id,
          gapColumns: gap,
          reason: `${gap} empty column${gap === 1 ? '' : 's'} in this row — try Smart fill or reset.`,
        });
      }
    }
    rowUsed = (rowUsed + cols) % 12;
    if (rowUsed === 0 && cols === 12) rowUsed = 0;
  }
  return suggestions;
}

export function applySmartLayout(pageId, layout) {
  if (!PAGE_DEFAULTS[pageId] || !layout?.widgets?.length) return layout;
  return {
    ...layout,
    widgets: equalizeMatrixSpans(layout.widgets),
  };
}
