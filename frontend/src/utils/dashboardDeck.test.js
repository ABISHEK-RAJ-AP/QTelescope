import { describe, expect, it } from 'vitest';
import { deckSlice } from './dashboardDeck.js';

describe('deckSlice', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

  it('keeps a short list on one page', () => {
    expect(deckSlice(ids.slice(0, 4), 3, 4)).toEqual({
      page: 0,
      pages: 1,
      items: ['a', 'b', 'c', 'd'],
    });
  });

  it('windows the overflow and wraps the page index', () => {
    expect(deckSlice(ids, 0, 4).items).toEqual(['a', 'b', 'c', 'd']);
    expect(deckSlice(ids, 1, 4)).toEqual({
      page: 1,
      pages: 2,
      items: ['e', 'f', 'g'],
    });
    expect(deckSlice(ids, 2, 4).page).toBe(0);
    expect(deckSlice(ids, -1, 4).page).toBe(1);
  });
});
