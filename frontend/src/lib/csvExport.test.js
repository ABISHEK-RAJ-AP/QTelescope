import { describe, expect, it } from 'vitest';
import { csvCell, rowsToCsv } from './csvExport.js';

describe('csvExport', () => {
  it('quotes fields with commas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
  });

  it('neutralizes formula injection', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+cmd')).toBe("'+cmd");
  });

  it('builds header row', () => {
    expect(rowsToCsv([{ x: 1, y: 2 }])).toBe('x,y\n1,2');
  });
});
