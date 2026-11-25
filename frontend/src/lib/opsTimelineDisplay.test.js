import { describe, expect, it } from 'vitest';
import {
  backendNameForId,
  timelineEventHeadline,
  timelineMetricTriplet,
} from './opsTimelineDisplay.js';

describe('opsTimelineDisplay', () => {
  it('backendNameForId uses registered backend name', () => {
    const name = backendNameForId('rigetti_x', [
      { backend_id: 'rigetti_x', backend_name: 'Rigetti Cepheus-1-108Q' },
    ]);
    expect(name).toBe('Rigetti Cepheus-1-108Q');
  });

  it('timelineEventHeadline prefers metric label for alerts', () => {
    const h = timelineEventHeadline({
      kind: 'alert',
      alert_type: 'HIGH_READOUT',
      resource_type: 'QUBIT',
      resource_id: 'q75',
      title: 'Long vendor sentence about readout error exceeding threshold',
    });
    expect(h).toMatch(/Qubit 75/i);
    expect(h.length).toBeLessThan(80);
  });

  it('timelineMetricTriplet formats percentage delta in points', () => {
    const t = timelineMetricTriplet({
      kind: 'alert',
      alert_type: 'HIGH_READOUT',
      resource_type: 'QUBIT',
      current_value: 0.104,
      threshold_value: 0.08,
    });
    expect(t).not.toBeNull();
    expect(t.observed).toMatch(/10\.4/);
    expect(t.threshold).toMatch(/8/);
    expect(t.delta).toMatch(/\+2\.40 pp/);
    expect(t.deltaLabel).toBe('Above threshold');
  });
});