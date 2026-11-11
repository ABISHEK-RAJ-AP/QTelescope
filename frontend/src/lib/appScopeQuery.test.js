import { describe, expect, it } from 'vitest';
import { mergeScopeSearch, parseScopeSearch } from './appScopeQuery.js';

describe('parseScopeSearch alerts filters', () => {
  it('reads severity and status', () => {
    const q = parseScopeSearch('?severity=CRITICAL&status=ACTIVE&backend=ibm_brisbane');
    expect(q.severity).toBe('CRITICAL');
    expect(q.status).toBe('ACTIVE');
    expect(q.backend).toBe('ibm_brisbane');
  });

  it('ignores invalid severity', () => {
    expect(parseScopeSearch('?severity=bogus').severity).toBe('');
  });

  it('merges severity patches', () => {
    const next = mergeScopeSearch('?backend=b1', { severity: 'WARNING' });
    expect(next.get('severity')).toBe('WARNING');
    expect(next.get('backend')).toBe('b1');
    const cleared = mergeScopeSearch(next, { severity: '' });
    expect(cleared.get('severity')).toBeNull();
  });
});
