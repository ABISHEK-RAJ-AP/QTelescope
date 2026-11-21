import { describe, expect, it, beforeEach } from 'vitest';
import {
  appendExportHistory,
  loadReportsSession,
  parseExportHistory,
  reportColumnLabel,
  saveReportsSession,
} from './reportsSession.js';

describe('reportsSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists prefs and export history', () => {
    saveReportsSession({ reportType: 'alerts', scope: 'ibm_brisbane', format: 'html' });
    expect(loadReportsSession().reportType).toBe('alerts');
    const saved = appendExportHistory({
      at: new Date().toISOString(),
      report: 'Alert log',
      format: 'CSV',
      rows: 3,
    });
    const history = parseExportHistory(saved.exportHistory);
    expect(history).toHaveLength(1);
    expect(history[0].rows).toBe(3);
  });

  it('labels operator-facing columns', () => {
    expect(reportColumnLabel('rule_type')).toBe('Rule / metric');
  });
});