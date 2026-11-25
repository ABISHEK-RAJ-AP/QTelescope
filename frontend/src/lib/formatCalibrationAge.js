/** Human-readable calibration age; sub-hour shows minutes (avoids misleading 0.0 h). */
export function formatCalibrationAgeHours(hours) {
  if (hours == null || !Number.isFinite(Number(hours))) return 'N/A';
  const n = Number(hours);
  if (n < 1) return `${Math.max(1, Math.round(n * 60))} min`;
  if (n < 10) return `${n.toFixed(1)} h`;
  return `${Math.round(n)} h`;
}