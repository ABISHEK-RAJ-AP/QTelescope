import { useEffect, useState } from 'react';
import { api } from '../api.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import ListViewToolbar from '../components/ListViewToolbar.jsx';
import AdaptiveListView from '../components/AdaptiveListView.jsx';
import { EmptyState, KpiStrip } from '../components/ui.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';
import { matchQuery } from '../lib/format.js';

const POOL_COLS = [
  { id: 'native', label: 'Native ID' },
  { id: 'execution', label: 'Execution' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'actions', label: 'Actions' },
];

export default function VirtualPools({ onOpen }) {
  const [pools, setPools] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ name: '', description: '' });
  const [memberAsset, setMemberAsset] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const prefs = useTablePrefs('virtual-pool-members', POOL_COLS);

  function reload() {
    setLoading(true);
    return Promise.all([
      api('/virtual-pools').catch(() => ({ items: [] })),
      api('/inventory/assets').catch(() => ({ items: [] })),
    ])
      .then(([poolBody, assetBody]) => {
        const next = poolBody.items || [];
        setPools(next);
        setAssets(assetBody.items || []);
        setSelected((cur) => cur || next[0]?.pool_id || '');
        setError('');
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  const detail = pools.find((p) => p.pool_id === selected);
  const visiblePools = pools.filter((p) => matchQuery(query, p.name, p.description, p.pool_id));
  const memberIds = new Set((detail?.members || []).map((m) => m.asset_id));
  const availableAssets = assets.filter((a) => !memberIds.has(a.asset_id));

  async function createPool(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const created = await api('/virtual-pools', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({ name: '', description: '' });
      setSelected(created.pool_id);
      setNotice('Pool created.');
      await reload();
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function addMember(event) {
    event.preventDefault();
    if (!selected || !memberAsset) return;
    setBusy(true);
    setNotice('');
    try {
      await api(`/virtual-pools/${encodeURIComponent(selected)}/members`, {
        method: 'POST',
        body: JSON.stringify({ asset_id: memberAsset }),
      });
      setMemberAsset('');
      setNotice('Asset linked to pool (each asset remains a separate resource).');
      await reload();
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <GovernPageShell
      eyebrow="Resource management"
      title="Virtual resource pools"
      subtitle="Logical groupings over registered inventory. Pools do not merge qubits or blur provider boundaries."
      loading={loading && pools.length === 0}
      error={error}
      notice={notice}
      onRetry={reload}
      onOpen={onOpen}
      loadingLabel="Loading virtual pools…"
    >
      {pools.length || assets.length ? (
        <KpiStrip
          items={[
            { key: 'pools', label: 'Pools', value: pools.length },
            { key: 'members', label: 'Members', value: pools.reduce((n, p) => n + (p.member_count || 0), 0) },
            { key: 'assets', label: 'Inventory', value: assets.length },
          ]}
        />
      ) : null}

      <div className="govern-review-grid">
        <form className="qre-card" onSubmit={createPool}>
          <h3 className="govern-section-title">Create pool</h3>
          <label className="qre-field">
            <span className="qre-field__label">Name</span>
            <input className="qre-field__input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="qre-field">
            <span className="qre-field__label">Description</span>
            <input className="qre-field__input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <button type="submit" className="qre-btn qre-btn--primary" disabled={busy}>
            Create pool
          </button>
        </form>

        <div className="qre-card">
          <div className="govern-section-head">
            <h3 className="govern-section-title">Pools</h3>
            <span className="govern-status">{pools.length}</span>
          </div>
          {pools.length > 0 ? (
            <div className="page-filters">
              <input
                className="govern-search"
                type="search"
                placeholder="Name or id…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Find pool"
              />
            </div>
          ) : null}
          {pools.length === 0 ? (
            <EmptyState
              title="No pools yet"
              hint="Create a pool, then attach existing inventory assets."
              action={
                <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen?.('#/inventory')}>
                  Open inventory
                </button>
              }
            />
          ) : (
            <div className="govern-resource-grid">
              {visiblePools.map((p) => (
                <button
                  key={p.pool_id}
                  type="button"
                  className={`govern-resource-card govern-resource-card--link${selected === p.pool_id ? ' govern-resource-card--on' : ''}`}
                  onClick={() => setSelected(p.pool_id)}
                >
                  <strong>{p.name}</strong>
                  <span className="govern-muted">{p.member_count} member{p.member_count === 1 ? '' : 's'}</span>
                  {p.description ? <span className="govern-table__sub">{p.description}</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {detail && (
        <div className="qre-card govern-dashboard-stack">
          <div className="govern-section-head">
            <h3 className="govern-section-title">{detail.name}</h3>
            <span className="govern-muted">{detail.pool_id}</span>
          </div>
          {detail.description && <p className="govern-muted">{detail.description}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ListViewToolbar prefs={prefs} columns={POOL_COLS} lockedIds={['native']} />
          </div>
          <AdaptiveListView
            prefs={prefs}
            items={detail.members || []}
            columns={POOL_COLS}
            rowKey={(row) => row.asset_id || row.native_asset_id}
            table={
            <div className="govern-table-wrap">
            <table className="govern-table">
              <thead>
                <tr>
                  {prefs.isVisible('native') && <th>Native ID</th>}
                  {prefs.isVisible('execution') && <th>Execution</th>}
                  {prefs.isVisible('lifecycle') && <th>Lifecycle</th>}
                  {prefs.isVisible('actions') && <th />}
                </tr>
              </thead>
              <tbody>
                {(detail.members || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="govern-muted">
                      No members
                    </td>
                  </tr>
                ) : (
                  detail.members.map((m) => (
                    <tr key={m.asset_id}>
                      {prefs.isVisible('native') && <td>{m.native_asset_id}</td>}
                      {prefs.isVisible('execution') && <td>{m.execution_class}</td>}
                      {prefs.isVisible('lifecycle') && <td>{m.lifecycle_state}</td>}
                      {prefs.isVisible('actions') && (
                      <td>
                        <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen?.(`#/inventory/${m.asset_id}`)}>
                          Open
                        </button>
                      </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
            }
          />
          <form className="govern-stack" onSubmit={addMember}>
            <label className="qre-field">
              <span className="qre-field__label">Add inventory asset</span>
              <select className="qre-field__input" value={memberAsset} onChange={(e) => setMemberAsset(e.target.value)} required>
                <option value="">{availableAssets.length ? 'Select asset…' : 'All registered assets are already members'}</option>
                {availableAssets.map((a) => (
                  <option key={a.asset_id} value={a.asset_id}>
                    {a.native_asset_id} ({a.execution_class})
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="qre-btn qre-btn--primary" disabled={busy || !memberAsset}>
              Add to pool
            </button>
          </form>
        </div>
      )}
    </GovernPageShell>
  );
}
