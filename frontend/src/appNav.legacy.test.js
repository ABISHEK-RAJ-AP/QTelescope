import { describe, expect, it } from 'vitest';
import { buildAppPath, isLegacyAppPath, parseAppPath } from './appNav.js';
import { consoleCommands, consolePath } from './lib/consoleRoutes.js';
import './lib/consoleTour.js';

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

  it('marks unknown console paths unmatched and does not rewrite them', () => {
    expect(parseAppPath('/app/not-a-page').unmatched).toBe(true);
    expect(isLegacyAppPath('/app/not-a-page')).toBe(false);
    expect(parseAppPath('/app/overview').unmatched).toBeUndefined();
  });

  it('palette and tour paths are the same URLs the shell builds', () => {
    for (const cmd of consoleCommands()) {
      expect(consolePath(cmd.id)).toBe(cmd.path);
      expect(buildAppPath(parseAppPath(cmd.path))).toBe(cmd.path);
    }
  });
});
