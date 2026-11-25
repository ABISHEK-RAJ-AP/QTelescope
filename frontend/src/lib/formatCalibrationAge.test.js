import { describe, expect, it } from 'vitest';
import { formatCalibrationAgeHours } from './formatCalibrationAge.js';

describe('formatCalibrationAgeHours', () => {
  it('uses minutes under one hour', () => {
    expect(formatCalibrationAgeHours(0.5)).toBe('30 min');
    expect(formatCalibrationAgeHours(0.01)).toBe('1 min');
  });

  it('uses hours at and above one hour', () => {
    expect(formatCalibrationAgeHours(3.5)).toBe('3.5 h');
    expect(formatCalibrationAgeHours(12)).toBe('12 h');
  });
});