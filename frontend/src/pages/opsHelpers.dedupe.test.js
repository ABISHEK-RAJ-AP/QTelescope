import { describe, expect, it } from 'vitest';
import { dropAlertsCoveredByIncidents } from './opsHelpers.js';

describe('dropAlertsCoveredByIncidents', () => {
  it('hides an alert when an incident on that backend already names the rule', () => {
    const rows = dropAlertsCoveredByIncidents([
      { kind: 'alert', id: 'a1', backend_id: 'ionq_forte', alert_type: 'STALE_CALIBRATION', title: 'stale' },
      { kind: 'incident', id: 'i1', backend_id: 'ionq_forte', title: 'ionq_forte — STALE_CALIBRATION' },
      { kind: 'alert', id: 'a2', backend_id: 'rigetti_aspen_m3', alert_type: 'BACKEND_OFFLINE', title: 'offline' },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['i1', 'a2']);
  });
});
