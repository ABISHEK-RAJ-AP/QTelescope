import { describe, expect, it } from 'vitest';
import { formatBackendTitle, formatProviderLabel, formatRuleLabel } from './displayLabels.js';

describe('formatBackendTitle', () => {
  it('prefers API name when distinct from id', () => {
    expect(formatBackendTitle({ backend_id: 'ibm_brisbane', backend_name: 'IBM Brisbane' })).toBe('IBM Brisbane');
  });

  it('humanizes id when name missing', () => {
    expect(formatBackendTitle({ backend_id: 'ibm_brisbane' })).toBe('IBM Brisbane');
  });

  it('prefers display name over snake id', () => {
    expect(formatBackendTitle({ backend_id: 'rigetti_cepheus_1_108q', backend_name: 'Cepheus-1-108Q' })).toBe('Cepheus-1-108Q');
  });
});

describe('formatProviderLabel', () => {
  it('maps provider ids', () => {
    expect(formatProviderLabel('ibm_quantum')).toBe('IBM Quantum');
    expect(formatProviderLabel('rigetti_quantum')).toBe('Rigetti');
  });
});

describe('formatRuleLabel', () => {
  it('formats alert types', () => {
    expect(formatRuleLabel('LOW_T1')).toBe('LOW T1');
  });
});
