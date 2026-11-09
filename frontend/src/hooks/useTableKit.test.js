import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableKit } from './useTableKit.js';

const rows = [
  { id: 'b', name: 'Bravo', n: 2 },
  { id: 'a', name: 'Alpha', n: 1 },
  { id: 'c', name: 'Charlie', n: 3 },
];

describe('useTableKit', () => {
  it('sorts ascending by key', () => {
    const { result } = renderHook(() => useTableKit(rows, { pageSize: 10, initialSort: { key: 'name', dir: 'asc' } }));
    expect(result.current.pageRows.map((r) => r.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('paginates and toggles sort direction', () => {
    const { result } = renderHook(() => useTableKit(rows, { pageSize: 2 }));
    expect(result.current.pageRows).toHaveLength(2);
    expect(result.current.totalPages).toBe(2);
    act(() => {
      result.current.toggleSort('n');
    });
    expect(result.current.sortKey).toBe('n');
    act(() => {
      result.current.toggleSort('n');
    });
    expect(result.current.sortDir).toBe('desc');
  });
});
