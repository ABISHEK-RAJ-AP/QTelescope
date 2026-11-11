import { describe, expect, it } from 'vitest';
import {
  formatObservedVsThreshold,
  isMetricThresholdAlert,
} from './alertSemantics.js';

describe('alertSemantics', () => {
  it('treats BACKEND_OFFLINE as non-metric', () => {
    const a = { alert_type: 'BACKEND_OFFLINE', backend_id: 'rigetti_aspen_m3', current_value: 0, threshold_value: 1 };
    expect(isMetricThresholdAlert(a)).toBe(false);
    expect(formatObservedVsThreshold(a)).toBe('Not applicable');
  });

  it('formats metric breach alerts', () => {
    const a = { alert_type: 'LOW_T1', resource_type: 'QUBIT', resource_id: 'q0', current_value: 12.3, threshold_value: 20 };
    expect(isMetricThresholdAlert(a)).toBe(true);
    expect(formatObservedVsThreshold(a)).toBe('12.3 µs vs 20.0');
  });
});
