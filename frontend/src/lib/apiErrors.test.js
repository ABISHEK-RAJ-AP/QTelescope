import { describe, expect, it } from 'vitest';
import { parseApiFailure } from './apiErrors.js';

describe('parseApiFailure', () => {
  it('maps structured error envelope', () => {
    const r = parseApiFailure(503, { error: { code: 'BACKEND_UNAVAILABLE', message: 'Upstream down.', request_id: 'req-1' } });
    expect(r.code).toBe('BACKEND_UNAVAILABLE');
    expect(r.message).toBe('Upstream down.');
    expect(r.requestId).toBe('req-1');
  });

  it('uses friendly copy for 403', () => {
    const r = parseApiFailure(403, {});
    expect(r.message).toMatch(/permission/i);
  });

  it('normalizes authentication required string', () => {
    const r = parseApiFailure(401, { detail: 'Authentication required' });
    expect(r.message).toMatch(/session ended/i);
  });
});
