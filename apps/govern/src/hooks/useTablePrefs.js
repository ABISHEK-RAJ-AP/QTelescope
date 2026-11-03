import { useMemo, useState } from 'react';

function storageKey(tableId) {
  return `qre.govern.table.${tableId}`;
}

function defaultVisible(columns) {
  return columns.filter((col) => col.defaultHidden !== true).map((col) => col.id);
}

function normalizeViewEntry(entry) {
  if (Array.isArray(entry)) return { visible: entry, layout: 'table' };
  if (entry && typeof entry === 'object' && Array.isArray(entry.visible)) {
    return {
      visible: entry.visible,
      layout: entry.layout === 'grid' ? 'grid' : 'table',
    };
  }
  return null;
}

function readStored(tableId, fallback) {
  try {
    const raw = localStorage.getItem(storageKey(tableId));
    if (!raw) return { visible: fallback, views: {}, activeView: null, layout: 'table' };
    const parsed = JSON.parse(raw);
    const visible = Array.isArray(parsed.visible) && parsed.visible.length ? parsed.visible : fallback;
    const layout = parsed.layout === 'grid' ? 'grid' : 'table';
    const views = {};
    if (parsed.views && typeof parsed.views === 'object') {
      for (const [name, entry] of Object.entries(parsed.views)) {
        const norm = normalizeViewEntry(entry);
        if (norm) views[name] = norm;
      }
    }
    return {
      visible,
      views,
      activeView: parsed.activeView || null,
      layout,
    };
  } catch {
    return { visible: fallback, views: {}, activeView: null, layout: 'table' };
  }
}

export function useTablePrefs(tableId, columns) {
  const fallback = useMemo(() => defaultVisible(columns), [columns]);
  const [state, setState] = useState(() => readStored(tableId, fallback));

  function persist(next) {
    setState(next);
    try {
      localStorage.setItem(storageKey(tableId), JSON.stringify(next));
    } catch {
      /* ignore quota / private mode */
    }
  }

  const visibleIds = state.visible?.length ? state.visible : fallback;

  const layout = state.layout === 'grid' ? 'grid' : 'table';

  return {
    visibleIds,
    layout,
    isVisible: (id) => visibleIds.includes(id),
    views: state.views || {},
    activeView: state.activeView,
    setLayout(nextLayout) {
      const mode = nextLayout === 'grid' ? 'grid' : 'table';
      persist({ ...state, layout: mode, activeView: null });
    },
    toggle(id) {
      const next = visibleIds.includes(id) ? visibleIds.filter((x) => x !== id) : [...visibleIds, id];
      if (!next.length) return;
      persist({ ...state, visible: next, activeView: null });
    },
    reset() {
      persist({ visible: fallback, views: state.views || {}, activeView: null, layout: 'table' });
    },
    saveView(name) {
      const label = String(name || '').trim();
      if (!label) return;
      persist({
        ...state,
        views: {
          ...(state.views || {}),
          [label]: { visible: visibleIds, layout },
        },
        activeView: label,
      });
    },
    applyView(name) {
      const entry = state.views?.[name];
      if (!entry?.visible?.length) return;
      persist({
        ...state,
        visible: entry.visible,
        layout: entry.layout === 'grid' ? 'grid' : 'table',
        activeView: name,
      });
    },
    deleteView(name) {
      const views = { ...(state.views || {}) };
      delete views[name];
      persist({ ...state, views, activeView: state.activeView === name ? null : state.activeView });
    },
  };
}
