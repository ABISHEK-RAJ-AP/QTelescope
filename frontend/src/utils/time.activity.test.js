import { describe, expect, it } from 'vitest';
import { formatActivity } from './time.js';

describe('formatActivity', () => {
  it('keeps a fresh clock and replaces an old one with relative age', () => {
    const fresh = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatActivity(fresh)).toMatch(/IST$/);
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatActivity(old)).toBe('2.0 h ago');
    expect(formatActivity(null)).toBe('N/A');
  });
});
