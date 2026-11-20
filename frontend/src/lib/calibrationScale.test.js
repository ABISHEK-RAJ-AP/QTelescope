import { describe, it, expect } from 'vitest';
import { distributionStats, heatColor, lerpHex, scaleRatio, sciFmt } from './calibrationScale.js';

describe('calibrationScale', () => {
  it('computes median on odd count', () => {
    const s = distributionStats([1, 3, 9]);
    expect(s.median).toBe(3);
    expect(s.min).toBe(1);
    expect(s.max).toBe(9);
  });

  it('scaleRatio inverts when higher is better', () => {
    const st = { min: 10, max: 20, median: 15, n: 2 };
    expect(scaleRatio(20, st, true)).toBe(0);
    expect(scaleRatio(10, st, true)).toBe(1);
  });

  it('sciFmt uses exponential for small rates', () => {
    expect(sciFmt(0.006836)).toMatch(/e-/i);
  });

  it('lerpHex accepts css rgb() tokens', () => {
    const mid = lerpHex('rgb(0, 0, 255)', 'rgb(255, 0, 0)', 0.5);
    expect(mid).toMatch(/^#[0-9a-f]{6}$/i);
    expect(mid.toLowerCase()).not.toContain('nan');
  });

  it('heatColor never returns NaN hex from rgb semantic colors', () => {
    const c = heatColor(0.5, {
      info: 'rgb(2, 132, 199)',
      critical: 'rgb(225, 29, 72)',
      unknown: '#64748b',
    });
    expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
});