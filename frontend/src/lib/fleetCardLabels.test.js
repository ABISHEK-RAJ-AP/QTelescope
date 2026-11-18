import { describe, expect, it } from 'vitest';
import { shouldShowFacilityTag } from './fleetCardLabels.js';

describe('shouldShowFacilityTag', () => {
  it('hides vendor product line duplicates', () => {
    expect(shouldShowFacilityTag({ facility: 'Rigetti QCS', provider: 'Rigetti' })).toBe(false);
    expect(shouldShowFacilityTag({ facility: 'C-DAC PARAM', provider: 'C-DAC' })).toBe(false);
  });

  it('shows real site names', () => {
    expect(shouldShowFacilityTag({ facility: 'Pune DR lab', provider: 'C-DAC' })).toBe(true);
  });
});