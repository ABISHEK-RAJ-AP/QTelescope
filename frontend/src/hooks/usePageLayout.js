import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applySmartLayout,
  readPageLayout,
  resetPageLayout,
  subscribePageLayouts,
  suggestLayoutGaps,
  writePageLayout,
} from '../lib/pageLayoutPrefs.js';

/** Cert Studio–style page layout hook (localStorage). */
export function usePageLayout(pageId) {
  const [layout, setLayout] = useState(() => readPageLayout(pageId));
  const [customizing, setCustomizing] = useState(false);

  useEffect(() => {
    setLayout(readPageLayout(pageId));
    return subscribePageLayouts((detail) => {
      if (detail?.pageId === pageId || detail?.reload) {
        setLayout(readPageLayout(pageId));
      }
    });
  }, [pageId]);

  const persistOrder = useCallback(
    (widgetIds) => {
      const byId = new Map(layout.widgets.map((w) => [w.id, w]));
      const nextWidgets = widgetIds.map((id) => byId.get(id)).filter(Boolean);
      layout.widgets.forEach((w) => {
        if (!nextWidgets.some((n) => n.id === w.id)) nextWidgets.push(w);
      });
      const next = writePageLayout(pageId, { ...layout, widgets: nextWidgets });
      setLayout(next);
    },
    [layout, pageId],
  );

  const setWidgetSpan = useCallback(
    (widgetId, span) => {
      const nextWidgets = layout.widgets.map((w) => (w.id === widgetId ? { ...w, span } : w));
      const next = writePageLayout(pageId, { ...layout, widgets: nextWidgets });
      setLayout(next);
    },
    [layout, pageId],
  );

  const resetLayout = useCallback(() => {
    const next = resetPageLayout(pageId);
    if (next) setLayout(next);
    setCustomizing(false);
  }, [pageId]);

  const applySmart = useCallback(() => {
    const next = applySmartLayout(pageId, layout);
    const saved = writePageLayout(pageId, next);
    setLayout(saved);
  }, [layout, pageId]);

  const layoutSuggestions = useMemo(
    () => suggestLayoutGaps(pageId, layout),
    [pageId, layout],
  );

  return {
    layout,
    customizing,
    setCustomizing,
    persistOrder,
    setWidgetSpan,
    resetLayout,
    applySmart,
    layoutSuggestions,
  };
}
