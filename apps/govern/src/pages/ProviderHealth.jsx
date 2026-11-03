import { useEffect, useState } from 'react';
import { api } from '../api.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import ListViewToolbar from '../components/ListViewToolbar.jsx';
import AdaptiveListView from '../components/AdaptiveListView.jsx';
import { EmptyState, KpiStrip } from '../components/ui.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';
import { matchQuery } from '../lib/format.js';

const HEALTH_COLS = [
  { id: 'status', label: 'Status' },
  { id: 'provider', label: 'Provider' },
  { id: 'integration', label: 'Integration' },
  { id: 'collection', label: 'Last collection' },
  { id: 'operations', label: 'Operations' },
];

const STAGE_LABEL = {
  I1: 'I1 · Catalogue',
  I2: 'I2 · Manifest',
  I3: 'I3 · Collected',
  I4: 'I4 · Handoff ready',
  I5: 'I5 · Reconciled dispatch',
  suspended: 'Suspended',
};

export default function ProviderHealth({ onOpen }) {
  const [items, setItems] = useState([]);
  const [legend, setLegend] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const prefs = useTablePrefs('provider-health', HEALTH_COLS);

  function load() {
    setLoading(true);
    setError('');
    api('/connectors')
      .then((body) => {
        setItems(body.items || []);
        setLegend(body.legend || {});
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <GovernPageShell
      eyebrow="Operations"
      title="Provider health"
      subtitle="Integration maturity from catalogue, manifests, and recorded collector runs — not simulated latency."
      loading={loading && items.length === 0}
      error={error}
      onRetry={load}
      onOpen={onOpen}
      loadingLabel="Loading provider status…"
    >
      {items.length > 0 ? (
        <KpiStrip
          items={['I1', 'I2', 'I3', 'I4', 'I5'].map((stage) => ({
            key: stage,
            label: stage,
            value: items.filter((row) => (row.integration?.stage || 'I1') === stage).length,
            hint: STAGE_LABEL[stage],
          }))}
        />
      ) : null}
      <div className="qre-card">
        {items.length === 0 ? (
          <EmptyState
            title="No providers in catalogue"
            hint="Discovery seeds providers on first Govern summary or connector load when the backend database is empty."
            action={
              <button type="button" className="qre-btn qre-btn--primary" onClick={() => onOpen?.('#/providers')}>
                Open providers
              </button>
            }
          />
        ) : (
          <>
          <div className="page-filters">
            <input
              className="govern-search"
              type="search"
              placeholder="Name, stage, status…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Find provider"
            />
            <ListViewToolbar prefs={prefs} columns={HEALTH_COLS} lockedIds={['provider']} />
          </div>
          <AdaptiveListView
            prefs={prefs}
            items={items.filter((row) => matchQuery(query, row.provider_name, row.provider_id, row.status, row.integration?.stage))}
            columns={HEALTH_COLS}
            rowKey={(row) => row.provider_id}
            table={
            <div className="govern-table-wrap">
            <table className="govern-table">
              <thead>
                <tr>
                  {prefs.isVisible('status') && <th>Status</th>}
                  {prefs.isVisible('provider') && <th>Provider</th>}
                  {prefs.isVisible('integration') && <th>Integration</th>}
                  {prefs.isVisible('collection') && <th>Last collection</th>}
                  {prefs.isVisible('operations') && <th>Operations</th>}
                </tr>
              </thead>
              <tbody>
                {items
                  .filter((row) =>
                    matchQuery(query, row.provider_name, row.provider_id, row.status, row.integration?.stage),
                  )
                  .map((row) => {
                  const integ = row.integration || {};
                  const stage = integ.stage || 'I1';
                  return (
                    <tr key={row.provider_id}>
                      {prefs.isVisible('status') && (
                      <td>
                        <span className={`govern-status${row.status === 'suspended' ? ' govern-status--bad' : ' govern-status--ok'}`}>
                          {row.status === 'suspended' ? 'Suspended' : 'Active'}
                        </span>
                        {integ.circuit_open && (
                          <span className="govern-status govern-status--warn" style={{ marginLeft: 6 }}>
                            Circuit open
                          </span>
                        )}
                      </td>
                      )}
                      {prefs.isVisible('provider') && (
                      <td>
                        <strong>{row.provider_name}</strong>
                        <div className="govern-table__sub">{row.provider_id}</div>
                      </td>
                      )}
                      {prefs.isVisible('integration') && <td>{STAGE_LABEL[stage] || stage}</td>}
                      {prefs.isVisible('collection') && (
                      <td className="govern-muted">
                        {integ.collector_last_run_at
                          ? `${integ.collector_last_status || '—'} · ${new Date(integ.collector_last_run_at).toLocaleString()}`
                          : 'No run recorded'}
                      </td>
                      )}
                      {prefs.isVisible('operations') && <td className="govern-muted">{(integ.operations || []).join(', ') || '—'}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            }
          />
        {Object.keys(legend).length > 0 && (
          <dl className="govern-dl" style={{ marginTop: 20 }}>
            {Object.entries(legend).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
          </>
        )}
      </div>
    </GovernPageShell>
  );
}
