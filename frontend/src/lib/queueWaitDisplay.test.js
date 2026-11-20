import { describe, it, expect } from 'vitest';
import { formatWaitFromResolved, resolveWaitSeconds } from './queueWaitDisplay.js';

describe('queueWaitDisplay', () => {
  it('uses history mean when vendor omits wait but jobs pending', () => {
    const r = resolveWaitSeconds(5, null, { wait_mean_s: 42 });
    expect(r.inferred).toBe(true);
    expect(r.seconds).toBe(42);
    expect(formatWaitFromResolved(r, 5).text).toMatch(/^~/);
  });

  it('shows dash when pending and no wait sources', () => {
    const r = resolveWaitSeconds(3, null, {});
    expect(r.seconds).toBeNull();
    expect(formatWaitFromResolved(r, 3).text).toBe('—');
  });
});