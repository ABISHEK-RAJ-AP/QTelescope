import { describe, expect, it } from 'vitest';
import { describeAnomalyFlag, formatAnomalyFlags } from './formatAnomalyFlags';

describe('formatAnomalyFlags', () => {
  it('renders object flags without [object Object]', () => {
    const flags = [{ severity: 'ANOMALY', reason: 'ewma_z_critical', z_score: 3.2 }];
    expect(formatAnomalyFlags(flags)).toEqual(['ANOMALY · ewma z critical · z 3.2']);
  });

  it('handles strings and empty input', () => {
    expect(formatAnomalyFlags(['legacy_flag'])).toEqual(['legacy_flag']);
    expect(formatAnomalyFlags(null)).toEqual([]);
  });

  it('describeAnomalyFlag skips junk objects gracefully', () => {
    expect(describeAnomalyFlag({})).toBe('Anomaly flag');
  });
});