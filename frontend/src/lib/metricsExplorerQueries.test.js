import { beforeEach, describe, expect, it } from 'vitest';
import {
  METRICS_EXPLORER_STORAGE_KEY,
  deleteSavedQuery,
  listSavedQueries,
  saveQuery,
} from './metricsExplorerQueries.js';

describe('metricsExplorerQueries', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves and lists one query', () => {
    saveQuery({
      name: 'Lab queue',
      metricId: 'pending_jobs',
      primaryBackend: 'ibm_brisbane',
      compareBackend: '',
      hours: 48,
    });
    const rows = listSavedQueries();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Lab queue');
    expect(rows[0].metricId).toBe('pending_jobs');
    expect(rows[0].hours).toBe(48);
    expect(window.localStorage.getItem(METRICS_EXPLORER_STORAGE_KEY)).toBeTruthy();
  });

  it('deletes a saved query', () => {
    const q = saveQuery({ name: 'A', metricId: 'cal_age', primaryBackend: 'x', hours: 12 });
    deleteSavedQuery(q.id);
    expect(listSavedQueries()).toHaveLength(0);
  });
});
