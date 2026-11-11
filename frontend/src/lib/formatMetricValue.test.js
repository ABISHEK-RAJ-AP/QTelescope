import { describe, expect, it } from 'vitest';
import { formatMetricValue, formatTableScalar } from './formatMetricValue.js';

describe('formatMetricValue', () => {
  it('maps null to Not available', () => {
    expect(formatMetricValue(null)).toBe('Not available');
    expect(formatMetricValue(undefined)).toBe('Not available');
  });

  it('formats numbers with unit', () => {
    expect(formatMetricValue(12.34, { decimals: 1, unit: 'µs' })).toBe('12.3 µs');
  });

  it('respects explicit state labels', () => {
    expect(formatMetricValue(null, { state: 'na' })).toBe('N/A');
    expect(formatMetricValue(0, { state: 'unsupported' })).toBe('Not supported');
  });

  it('allows genuine zero', () => {
    expect(formatMetricValue(0)).toBe('0');
  });
});

describe('formatTableScalar', () => {
  it('never returns em dash for missing values', () => {
    expect(formatTableScalar(null)).toBe('Not available');
    expect(formatTableScalar(undefined)).toBe('Not available');
  });
});
