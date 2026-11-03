import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api, apiBase, authHeaders } from '../api.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import ListViewToolbar from '../components/ListViewToolbar.jsx';
import AdaptiveListView from '../components/AdaptiveListView.jsx';
import { EmptyState, KpiStrip, PeriodRange } from '../components/ui.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';

const METER_COLS = [
  { id: 'dimension', label: 'Dimension' },
  { id: 'metric', label: 'Metric' },
  { id: 'unit', label: 'Unit' },
  { id: 'sum', label: 'Sum' },
  { id: 'samples', label: 'Samples' },
  { id: 'unavailable', label: 'Unavailable' },
  { id: 'latest', label: 'Latest' },
];

export default function CapacityUtilization({ onOpen, permissions = [] }) {
  const [rollup, setRollup] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const canIngest = permissions.includes('metering:ingest') || permissions.includes('platform:manage');
  const canExport = permissions.includes('metering:export') || permissions.includes('reports:export');
  const prefs = useTablePrefs('capacity-meters', METER_COLS);

  function reload() {
    setLoading(true);
    setError('');
    return api(`/meter-rollups?hours=${encodeURIComponent(hours)}`)
      .then(setRollup)
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, [hours]);

  async function ingestDemo(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      await api('/meter-samples', {
        method: 'POST',
        body: JSON.stringify({
          dimension: 'backend:demo-qpu',
          metric: 'queue_depth',
          unit: 'jobs',
          value: 3,
          connector_id: 'govern-demo',
        }),
      });
      setNotice('Demo sample ingested.');
      await reload();
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch(
        `${apiBase()}/meter-rollups/export?hours=${encodeURIComponent(hours)}`,
        { headers: authHeaders() },
      );
      const text = await response.text();
      if (!response.ok) throw new Error(text || response.statusText);
      const blob = new Blob([text], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `meter-rollups-${hours}h.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      setNotice('Export downloaded.');
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  const items = rollup?.items || [];

  return (
    <GovernPageShell
      variant="band"
      eyebrow="Governance"
      title="Capacity & utilization"
      subtitle="Aggregates from ingested meter samples only. Missing or unknown units are stored as unavailable — never shown as zero."
      loading={loading && !rollup}
      error={error}
      notice={notice}
      onRetry={reload}
      onOpen={onOpen}
      loadingLabel="Loading capacity rollups…"
      actions={
        <>
          <PeriodRange hours={hours} onChange={setHours} label="Rollup window" />
          {canExport ? (
            <button type="button" className="qre-btn qre-btn--ghost" onClick={exportCsv} disabled={busy}>
              <Download size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {busy ? 'Working…' : 'Export CSV'}
            </button>
          ) : null}
        </>
      }
    >
      {rollup ? (
        <KpiStrip
          items={[
            { key: 'raw', label: 'Raw samples', value: rollup.sample_count ?? 0 },
            { key: 'rows', label: 'Rollup rows', value: items.length },
            {
              key: 'avail',
              label: 'Available',
              value: items.reduce((n, row) => n + (row.available_samples || 0), 0),
            },
            {
              key: 'miss',
              label: 'Unavailable',
              value: items.reduce((n, row) => n + (row.unavailable_samples || 0), 0),
            },
          ]}
        />
      ) : null}
      <p className="govern-muted" style={{ margin: 0 }}>
        {rollup?.sample_count ?? 0} raw sample{(rollup?.sample_count ?? 0) === 1 ? '' : 's'} since{' '}
        {rollup?.since ? new Date(rollup.since).toLocaleString() : '—'}.
      </p>

      {canIngest && import.meta.env.DEV && (
        <form className="qre-card govern-stack" onSubmit={ingestDemo}>
          <h3 className="govern-section-title">Dev: ingest sample</h3>
          <p className="govern-muted" style={{ margin: 0 }}>
            Connectors normally POST meter samples. This button inserts one demo row for UI verification.
          </p>
          <button type="submit" className="qre-btn qre-btn--ghost" disabled={busy}>
            {busy ? 'Ingesting…' : 'Insert demo sample'}
          </button>
        </form>
      )}

      <div className="qre-card">
        {items.length === 0 ? (
          <EmptyState
            title="No meter samples in window"
            hint="When connectors or operators POST meter samples, rollups appear here grouped by dimension and metric."
            action={
              <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen?.('#/connectors')}>
                Open provider health
              </button>
            }
          />
        ) : (
          <AdaptiveListView
            prefs={prefs}
            items={items}
            columns={METER_COLS}
            rowKey={(row) => `${row.dimension}:${row.metric}:${row.unit}`}
            table={
            <div className="govern-table-wrap">
            <table className="govern-table">
              <thead>
                <tr>
                  {prefs.isVisible('dimension') && <th>Dimension</th>}
                  {prefs.isVisible('metric') && <th>Metric</th>}
                  {prefs.isVisible('unit') && <th>Unit</th>}
                  {prefs.isVisible('sum') && <th>Sum (available)</th>}
                  {prefs.isVisible('samples') && <th>Samples</th>}
                  {prefs.isVisible('unavailable') && <th>Unavailable</th>}
                  {prefs.isVisible('latest') && <th>Latest</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={`${row.dimension}:${row.metric}:${row.unit}`}>
                    {prefs.isVisible('dimension') && <td className="govern-mono">{row.dimension}</td>}
                    {prefs.isVisible('metric') && <td>{row.metric}</td>}
                    {prefs.isVisible('unit') && <td>{row.unit}</td>}
                    {prefs.isVisible('sum') && <td>{row.available_samples ? row.sum_value : '—'}</td>}
                    {prefs.isVisible('samples') && <td>{row.available_samples}</td>}
                    {prefs.isVisible('unavailable') && <td>{row.unavailable_samples || '—'}</td>}
                    {prefs.isVisible('latest') && (
                    <td className="govern-muted">
                      {row.latest_source_time ? new Date(row.latest_source_time).toLocaleString() : '—'}
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            }
          />
        )}
      </div>
    </GovernPageShell>
  );
}
