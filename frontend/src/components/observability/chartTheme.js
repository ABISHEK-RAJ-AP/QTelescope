/** Shared ECharts colors for light/dark (Sprint 1). */

export function getFontScale() {
  if (typeof document === 'undefined') return 1;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--font-scale').trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function scaledFont(px) {
  return Math.round(px * getFontScale());
}

/** Status / series colors from design tokens (read at call time for theme changes). */
export function getChartSemanticColors() {
  if (typeof document === 'undefined') {
    return {
      healthy: '#059669', critical: '#e11d48', warn: '#d97706', info: '#2563eb', unknown: '#64748b',
      accent: '#0891b2', series: '#0891b2',
    };
  }
  const root = getComputedStyle(document.documentElement);
  const v = (name, fallback) => {
    const c = root.getPropertyValue(name).trim();
    return c || fallback;
  };
  return {
    healthy: v('--ds-status-healthy', '#059669'),
    critical: v('--ds-status-critical', '#e11d48'),
    warn: v('--ds-status-warn', '#d97706'),
    info: v('--ds-status-info', '#2563eb'),
    unknown: v('--ds-status-unknown', '#64748b'),
    accent: v('--ds-accent', '#0891b2'),
    series: v('--ds-accent', '#0891b2'),
  };
}

/** Router / qubit health stacks (GREEN · YELLOW · RED · UNKNOWN). */
export function getFleetStateChartColors() {
  const sem = getChartSemanticColors();
  return { GREEN: sem.healthy, YELLOW: sem.warn, RED: sem.critical, UNKNOWN: sem.unknown };
}

/** Heatmap / graph labels on tinted cells — stays readable in light and dark. */
export function getChartInkColor() {
  if (typeof document === 'undefined') return '#0b1220';
  return document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#0b1220';
}

/** Distinct series colors when multiple modalities share one chart (stable order). */
export function getModalityChartPalette() {
  const sem = getChartSemanticColors();
  return [sem.healthy, sem.info, sem.accent, sem.warn, sem.unknown];
}

/** Alert/event severity markers on timeline scatter charts. */
export function getSeverityChartColors() {
  const sem = getChartSemanticColors();
  return { CRITICAL: sem.critical, WARNING: sem.warn, INFO: sem.info };
}

/** Job execution states (Job monitoring badges / charts). */
export function getJobStatusChartColors() {
  const sem = getChartSemanticColors();
  return {
    COMPLETED: sem.healthy,
    FAILED: sem.critical,
    CANCELLED: sem.warn,
    RUNNING: sem.accent,
    QUEUED: sem.unknown,
  };
}

/** Calibration freshness buckets (Calibration status page). */
export function getCalibrationStatusChartColors() {
  const sem = getChartSemanticColors();
  return {
    Fresh: sem.healthy,
    Recent: sem.info,
    Aging: sem.warn,
    Stale: sem.critical,
    None: sem.unknown,
  };
}

/** Anomaly heatmap severities (maps to alert semantic colors). */
export function getAnomalySeverityChartColors() {
  const sev = getSeverityChartColors();
  const sem = getChartSemanticColors();
  return {
    ANOMALY: sev.CRITICAL,
    WARNING: sev.WARNING,
    CHANGE_POINT: sev.INFO,
    default: sem.unknown,
  };
}

export function getChartTheme(isDark) {
  return {
    splitColor: isDark ? '#1e293b' : '#f1f5f9',
    textColor: isDark ? '#94a3b8' : '#64748b',
    tooltipBg: isDark ? '#0f172a' : '#ffffff',
    tooltipBorder: isDark ? '#334155' : '#cbd5e1',
    tooltipText: isDark ? '#f8fafc' : '#0f172a',
    axisLine: isDark ? '#334155' : '#cbd5e1',
  };
}

export function baseTooltip(isDark) {
  const t = getChartTheme(isDark);
  return {
    trigger: 'axis',
    backgroundColor: t.tooltipBg,
    borderColor: t.tooltipBorder,
    borderWidth: 1,
    textStyle: { color: t.tooltipText, fontSize: scaledFont(12) },
    confine: true,
    extraCssText: 'max-width: 320px; white-space: normal; line-height: 1.45;',
  };
}

/** Point / node / edge hover — concise multi-line HTML via formatter. */
export function itemTooltip(isDark, formatter) {
  return {
    ...baseTooltip(isDark),
    trigger: 'item',
    formatter,
  };
}

const num = (v, d = 2) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(d));

/** Shared health-qubit one-liner block for scatter / fleet charts. */
export function formatQubitHealthTooltip(q, lines = []) {
  const head = `<b>Q${q.qubit_index ?? q.qubit}</b>${q.state ? ` · ${q.state}` : ''}`;
  const metrics = [
    q.t1 != null || q.value?.[0] != null ? `T1 ${num(q.t1 ?? q.value?.[0], 1)} µs` : null,
    q.readout_error != null || q.value?.[1] != null ? `Readout ${num(q.readout_error ?? q.value?.[1], 4)}` : null,
  ].filter(Boolean).join(' · ');
  return [head, metrics, ...lines].filter(Boolean).join('<br/>');
}

/** Axis / legend font sizes that respect accessibility scaling. */
export function chartLabelStyle(isDark, px = 11) {
  const t = getChartTheme(isDark);
  return { color: t.textColor, fontSize: scaledFont(px) };
}

/** Reserve space for legend + axis labels so titles do not overlap series. */
export function polishChartOption(option, isDark, { legendPosition } = {}) {
  if (!option || typeof option !== 'object') return option;
  const out = { ...option };
  const hasLegend = out.legend != null && out.legend !== false;
  const legPos = legendPosition
    || (out.legend?.bottom != null ? 'bottom' : 'top');

  const grid = {
    left: 12,
    right: 16,
    containLabel: true,
    ...(out.grid || {}),
  };

  if (hasLegend) {
    const legPad = scaledFont(36);
    out.legend = {
      type: 'scroll',
      orient: 'horizontal',
      width: '92%',
      itemGap: scaledFont(12),
      itemWidth: scaledFont(12),
      itemHeight: scaledFont(8),
      textStyle: chartLabelStyle(isDark, 10),
      pageTextStyle: chartLabelStyle(isDark, 9),
      pageIconSize: scaledFont(10),
      ...(typeof out.legend === 'object' ? out.legend : {}),
    };
    if (legPos === 'bottom') {
      out.legend.bottom = out.legend.bottom ?? 2;
      delete out.legend.top;
      grid.top = grid.top ?? scaledFont(18);
      grid.bottom = Math.max(Number(grid.bottom) || 0, legPad);
    } else {
      out.legend.top = out.legend.top ?? 2;
      delete out.legend.bottom;
      grid.top = Math.max(Number(grid.top) || 0, legPad);
      grid.bottom = grid.bottom ?? scaledFont(28);
    }
  } else {
    grid.top = grid.top ?? scaledFont(16);
    grid.bottom = grid.bottom ?? scaledFont(24);
  }

  out.grid = grid;
  return out;
}
