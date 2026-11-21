import { describe, expect, it } from 'vitest';
import { sortCopy } from './sortCopy.js';

describe('sortCopy', () => {
  it('sorts without mutating source', () => {
    const a = [3, 1, 2];
    expect(sortCopy(a)).toEqual([1, 2, 3]);
    expect(a).toEqual([3, 1, 2]);
  });

  it('sorts spread Set entries (orphan backend ids)', () => {
    expect(sortCopy([...new Set(['z-backend', 'a-backend'])])).toEqual(['a-backend', 'z-backend']);
  });
});