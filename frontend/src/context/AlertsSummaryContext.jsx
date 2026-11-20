import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { api, peekApiCache } from '../services/api';

const AlertsSummaryContext = createContext(null);
const TTL_MS = 25_000;
const POLL_MS = 30_000;

export function AlertsSummaryProvider({ children, enabled = true }) {
  const [summary, setSummary] = useState(() => peekApiCache('/alerts/summary') ?? null);
  const summaryRef = useRef(summary);
  summaryRef.current = summary;
  const lastFetch = useRef(0);
  const inflight = useRef(null);

  const applySummary = useCallback((s) => {
    if (!s) return;
    setSummary(s);
    lastFetch.current = Date.now();
  }, []);

  const refreshSummary = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    const cur = summaryRef.current;
    if (!force && cur && now - lastFetch.current < TTL_MS) {
      return cur;
    }
    if (inflight.current) {
      return inflight.current;
    }
    inflight.current = api.getAlertsSummary()
      .then((s) => {
        applySummary(s);
        inflight.current = null;
        return s;
      })
      .catch((err) => {
        inflight.current = null;
        if (err?.sessionExpired) return null;
        throw err;
      });
    return inflight.current;
  }, [applySummary]);

  const syncFromCounts = useCallback(({ active, critical, warning }) => {
    setSummary((prev) => ({
      ...(prev || {}),
      active: active ?? prev?.active ?? 0,
      critical: critical ?? prev?.critical ?? 0,
      warning: warning ?? prev?.warning ?? 0,
    }));
    lastFetch.current = Date.now();
  }, []);

  const invalidateSummary = useCallback(() => {
    lastFetch.current = 0;
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refreshSummary({ force: true }).catch(() => {});
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshSummary({ force: false }).catch(() => {});
    }, POLL_MS);
    const kick = setTimeout(() => refreshSummary({ force: false }).catch(() => {}), 800);
    return () => {
      clearInterval(interval);
      clearTimeout(kick);
    };
  }, [refreshSummary, enabled]);

  const value = useMemo(() => ({
    summary,
    activeCount: summary?.active ?? 0,
    criticalCount: summary?.critical ?? 0,
    refreshSummary,
    syncFromCounts,
    invalidateSummary,
  }), [summary, refreshSummary, syncFromCounts, invalidateSummary]);

  return (
    <AlertsSummaryContext.Provider value={value}>
      {children}
    </AlertsSummaryContext.Provider>
  );
}

export function useAlertsSummary() {
  const ctx = useContext(AlertsSummaryContext);
  if (!ctx) {
    throw new Error('useAlertsSummary must be used within AlertsSummaryProvider');
  }
  return ctx;
}
