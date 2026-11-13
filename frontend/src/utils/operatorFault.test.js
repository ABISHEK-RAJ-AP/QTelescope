import { describe, expect, it } from 'vitest';
import { collectorQueueTitle, summarizeOperatorError } from './operatorFault.js';

describe('summarizeOperatorError', () => {
  it('hides SQL details', () => {
    expect(summarizeOperatorError('UNIQUE constraint failed: connectivity_edges.edge_id')).toMatch(/data store rejected/i);
    expect(summarizeOperatorError('no such table: providers')).toMatch(/data store rejected/i);
  });

  it('keeps short plain messages', () => {
    expect(summarizeOperatorError('rate limited')).toBe('rate limited');
  });
});

describe('collectorQueueTitle', () => {
  it('never includes raw error string', () => {
    const t = collectorQueueTitle('ibm', { status: 'ERROR', error: 'sqlite3.OperationalError: database is locked' });
    expect(t).not.toMatch(/sqlite/i);
    expect(t).toMatch(/data store rejected/i);
  });
});
