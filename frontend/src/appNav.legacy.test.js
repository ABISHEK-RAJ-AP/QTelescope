import { describe, expect, it } from 'vitest';
import { buildAppPath, isLegacyAppPath, parseAppPath } from './appNav.js';

describe('isLegacyAppPath', () => {
  it('redirects bare /app and legacy operations paths', () => {
    expect(isLegacyAppPath('/app')).toBe(true);
    expect(isLegacyAppPath('/app/operations/health')).toBe(true);
    expect(isLegacyAppPath('/app/operations/timeline')).toBe(true);
  });

  it('redirects aliases that parse to a different canonical URL', () => {
    expect(isLegacyAppPath('/app/backends/qubits')).toBe(true);
    expect(isLegacyAppPath('/app/resources/qdmi')).toBe(true);
    expect(isLegacyAppPath('/app/resources/metrics')).toBe(true);
    expect(buildAppPath(parseAppPath('/app/resources/metrics'))).toBe('/app/telemetry/metrics');
  });

  it('leaves canonical paths alone', () => {
    expect(isLegacyAppPath('/app/overview')).toBe(false);
    expect(isLegacyAppPath('/app/operate')).toBe(false);
    expect(isLegacyAppPath('/app/telemetry/compare')).toBe(false);
  });
});
