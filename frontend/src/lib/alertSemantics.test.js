import { describe, expect, it } from 'vitest';
import {
  formatAlertMetricLabel,
  formatObservedVsThreshold,
  isMetricThresholdAlert,
} from './alertSemantics.js';

describe('alertSemantics', () => {
  it('treats BACKEND_OFFLINE as non-metric', () => {
    const a = { alert_type: 'BACKEND_OFFLINE', backend_id: 'rigetti_aspen_m3', current_value: 0, threshold_value: 1 };
    expect(isMetricThresholdAlert(a)).toBe(false);
    expect(formatObservedVsThreshold(a)).toBe('Not applicable');
  });

  it('formats T1 breach in µs with minimum bound', () => {
    const a = { alert_type: 'LOW_T1', resource_type: 'QUBIT', resource_id: 'q0', current_value: 12.3, threshold_value: 20 };
    expect(isMetricThresholdAlert(a)).toBe(true);
    expect(formatObservedVsThreshold(a)).toBe('12.3 µs / min 20.0 µs');
    expect(formatAlertMetricLabel(a)).toBe('T1 coherence');
  });

  it('formats stale calibration in hours with maximum bound', () => {
    const a = {
      alert_type: 'STALE_CALIBRATION',
      resource_type: 'CALIBRATION',
      resource_id: 'ibm_brisbane',
      current_value: 3.1,
      threshold_value: 24,
    };
    expect(isMetricThresholdAlert(a)).toBe(true);
    expect(formatObservedVsThreshold(a)).toBe('3.1 h / max 24.0 h');
    expect(formatAlertMetricLabel(a)).toBe('Calibration age');
  });

  it('formats queue depth in jobs', () => {
    const a = { alert_type: 'HIGH_QUEUE', resource_type: 'QUEUE', current_value: 42, threshold_value: 30 };
    expect(formatObservedVsThreshold(a)).toBe('42.0 jobs / max 30.0 jobs');
  });
});