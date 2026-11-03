import { useEffect, useState } from 'react';
import { api } from '../api.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import ListViewToolbar from '../components/ListViewToolbar.jsx';
import AdaptiveListView from '../components/AdaptiveListView.jsx';
import { ConfirmDialog, EmptyState, KpiStrip } from '../components/ui.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';
import { matchQuery } from '../lib/format.js';

const PROVIDER_COLS = [
  { id: 'status', label: 'Status' },
  { id: 'name', label: 'Name' },
  { id: 'id', label: 'Provider ID' },
  { id: 'integration', label: 'Integration' },
  { id: 'actions', label: 'Actions' },
];

function useList(path, query = '') {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function reload() {
    setLoading(true);
    api(`${path}${query}`)
      .then((body) => {
        setItems(body.items || []);
        setError('');
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, [path, query]);

  return { items, error, loading, reload };
}

export function Inventory({ onOpen, permissions = [] }) {
  const [filters, setFilters] = useState({ execution_class: '', asset_class: '', lifecycle_state: '', provider_id: '' });
  const [busy, setBusy] = useState(false);
  const query = (() => {
    const p = new URLSearchParams();
    if (filters.execution_class) p.set('execution_class', filters.execution_class);
    if (filters.asset_class) p.set('asset_class', filters.asset_class);
    if (filters.lifecycle_state) p.set('lifecycle_state', filters.lifecycle_state);
    if (filters.provider_id) p.set('provider_id', filters.provider_id);
    const s = p.toString();
    return s ? `?${s}` : '';
  })();
  const { items, error, loading, reload } = useList('/inventory/assets', query);
  const [form, setForm] = useState({ provider_id: '', native_asset_id: '', asset_class: 'QPU', execution_class: 'hardware' });
  const [importProvider, setImportProvider] = useState('');
  const [importCsv, setImportCsv] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [providers, setProviders] = useState([]);
  const canImport = permissions.includes('inventory:import') || permissions.includes('platform:manage');

  useEffect(() => {
    api('/providers')
      .then((body) => setProviders(body.items || []))
      .catch(() => setProviders([]));
  }, []);
  const visible = items.filter((row) =>
    matchQuery(search, row.native_asset_id, row.provider_id, row.asset_class, row.lifecycle_state, row.execution_class),
  );

  async function add(event) {
    event.preventDefault();
    setNotice('');
    setBusy(true);
    try {
      await api('/inventory/assets', { method: 'POST', body: JSON.stringify(form) });
      setNotice('Asset saved.');
      reload();
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function runImport(event) {
    event.preventDefault();
    if (!importProvider.trim() || !importCsv.trim()) return;
    setNotice('');
    setBusy(true);
    try {
      const result = await api('/inventory/imports', {
        method: 'POST',
        body: JSON.stringify({ provider_id: importProvider.trim(), csv_text: importCsv }),
      });
      setNotice(`Import complete: ${result.created ?? result.imported ?? 0} asset(s).`);
      setImportCsv('');
      reload();
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <GovernPageShell
      eyebrow="Resources"
      title="Institutional inventory"
      subtitle="Capability discovery filters the registry. Each row is one physical or simulated asset."
      loading={loading && items.length === 0}
      error={error}
      notice={notice}
      onRetry={reload}
      onOpen={onOpen}
      loadingLabel="Loading inventory…"
    >
      {items.length > 0 ? (
        <KpiStrip
          items={[
            { key: 'hw', label: 'Hardware', value: items.filter((row) => row.execution_class === 'hardware').length },
            { key: 'sim', label: 'Simulated', value: items.filter((row) => row.execution_class === 'simulated').length },
            { key: 'active', label: 'Active', value: items.filter((row) => (row.lifecycle_state || 'registered') === 'active').length },
            { key: 'maint', label: 'Maintenance', value: items.filter((row) => row.lifecycle_state === 'maintenance').length },
          ]}
        />
      ) : null}
      <div className="page-filters">
        <label className="qre-field">
          <span className="qre-field__label">Execution class</span>
          <select
            className="qre-field__input"
            value={filters.execution_class}
            onChange={(e) => setFilters({ ...filters, execution_class: e.target.value })}
          >
            <option value="">Any</option>
            <option value="hardware">Hardware</option>
            <option value="simulated">Simulated</option>
          </select>
        </label>
        <label className="qre-field">
          <span className="qre-field__label">Asset class</span>
          <input
            className="qre-field__input"
            placeholder="e.g. QPU"
            value={filters.asset_class}
            onChange={(e) => setFilters({ ...filters, asset_class: e.target.value })}
          />
        </label>
        <label className="qre-field">
          <span className="qre-field__label">Provider</span>
          <select
            className="qre-field__input"
            value={filters.provider_id}
            onChange={(e) => setFilters({ ...filters, provider_id: e.target.value })}
          >
            <option value="">Any</option>
            {providers.map((p) => (
              <option key={p.provider_id} value={p.provider_id}>
                {p.provider_name || p.provider_id}
              </option>
            ))}
          </select>
        </label>
        <label className="qre-field">
          <span className="qre-field__label">Lifecycle</span>
          <select
            className="qre-field__input"
            value={filters.lifecycle_state}
            onChange={(e) => setFilters({ ...filters, lifecycle_state: e.target.value })}
          >
            <option value="">Any</option>
            <option value="registered">Registered</option>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="suspended">Suspended</option>
            <option value="retired">Retired</option>
          </select>
        </label>
        <input
          className="govern-search"
          type="search"
          placeholder="Search ID, provider, class…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Find asset"
        />
      </div>
      <div className="govern-review-grid">
        <div className="qre-card">
          <div className="govern-section-head">
            <h3 className="govern-section-title">Registered assets</h3>
            <span className="govern-status">{visible.length}</span>
          </div>
          {visible.length === 0 ? (
            <EmptyState
              title={items.length ? 'No assets match these filters' : 'No assets yet'}
              hint={
                items.length
                  ? 'Clear search or discovery filters to see the rest of the registry.'
                  : 'Register a hardware or simulated asset using the form, or import a CSV if your role allows it.'
              }
              action={
                items.length ? (
                  <button
                    type="button"
                    className="qre-btn qre-btn--ghost"
                    onClick={() => {
                      setSearch('');
                      setFilters({ execution_class: '', asset_class: '', lifecycle_state: '', provider_id: '' });
                    }}
                  >
                    Clear filters
                  </button>
                ) : (
                  <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen?.('#/providers')}>
                    Open providers
                  </button>
                )
              }
            />
          ) : (
            <div className="govern-resource-grid">
              {visible.map((row) => (
                <button
                  key={row.asset_id}
                  type="button"
                  className="govern-resource-card govern-resource-card--link"
                  onClick={() => onOpen?.(`#/inventory/${row.asset_id}`)}
                >
                  <span className={`govern-status${row.execution_class === 'hardware' ? ' govern-status--ok' : ''}`}>
                    {row.execution_class === 'hardware' ? 'Hardware' : 'Simulated'}
                  </span>
                  <strong>{row.native_asset_id}</strong>
                  <span className="govern-muted">
                    {row.asset_class} · {row.provider_id} · {row.lifecycle_state || 'registered'}
                  </span>
                  <span className="govern-table__sub">{row.provenance}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <form className="qre-card" onSubmit={add}>
          <div className="govern-section-head">
            <h3 className="govern-section-title">Register asset</h3>
          </div>
          <div className="govern-form-grid">
          <label className="qre-field">
            <span className="qre-field__label">Provider ID</span>
            {providers.length ? (
              <select
                className="qre-field__input"
                value={form.provider_id}
                onChange={(e) => setForm({ ...form, provider_id: e.target.value })}
                required
              >
                <option value="">Select provider…</option>
                {providers.map((p) => (
                  <option key={p.provider_id} value={p.provider_id}>
                    {p.provider_name || p.provider_id}
                  </option>
                ))}
              </select>
            ) : (
              <input className="qre-field__input" value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })} required />
            )}
          </label>
          <label className="qre-field">
            <span className="qre-field__label">Native asset ID</span>
            <input className="qre-field__input" value={form.native_asset_id} onChange={(e) => setForm({ ...form, native_asset_id: e.target.value })} required />
          </label>
          <label className="qre-field">
            <span className="qre-field__label">Asset class</span>
            <input className="qre-field__input" value={form.asset_class} onChange={(e) => setForm({ ...form, asset_class: e.target.value })} required />
          </label>
          <label className="qre-field">
            <span className="qre-field__label">Execution class</span>
            <select className="qre-field__input" value={form.execution_class} onChange={(e) => setForm({ ...form, execution_class: e.target.value })}>
              <option value="hardware">Hardware</option>
              <option value="simulated">Simulated</option>
            </select>
          </label>
          </div>
          <button className="qre-btn qre-btn--primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save asset'}
          </button>
        </form>
      </div>
        {canImport && (
          <form className="qre-card govern-stack" onSubmit={runImport}>
            <h3 className="govern-section-title">Bulk CSV import</h3>
            <p className="govern-muted" style={{ margin: 0 }}>
              Header row: <code className="govern-mono">native_asset_id,asset_class,execution_class</code>
            </p>
            <label className="qre-field">
              <span className="qre-field__label">Provider ID</span>
              <input
                className="qre-field__input"
                value={importProvider}
                onChange={(e) => setImportProvider(e.target.value)}
                required
              />
            </label>
            <label className="qre-field">
              <span className="qre-field__label">CSV text</span>
              <textarea
                className="qre-field__input govern-mono"
                rows={6}
                value={importCsv}
                onChange={(e) => setImportCsv(e.target.value)}
                placeholder={'native_asset_id,asset_class,execution_class\nqpu-1,QPU,hardware'}
                required
              />
            </label>
            <button type="submit" className="qre-btn qre-btn--ghost" disabled={busy}>
              {busy ? 'Importing…' : 'Run import'}
            </button>
          </form>
        )}
    </GovernPageShell>
  );
}

const MANIFEST_OPS = ['submit', 'compile', 'simulate', 'status'];

export function Providers({ onOpen }) {
  const { items, error, loading, reload } = useList('/providers');
  const [notice, setNotice] = useState('');
  const [onboardId, setOnboardId] = useState('');
  const [ops, setOps] = useState(['submit']);
  const [onboardBusy, setOnboardBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [pendingSuspend, setPendingSuspend] = useState(null);
  const [busy, setBusy] = useState(false);
  const prefs = useTablePrefs('providers', PROVIDER_COLS);
  const visible = items.filter((row) => matchQuery(query, row.provider_name, row.provider_id, row.status));

  async function setStatus(providerId, status) {
    setNotice('');
    setBusy(true);
    try {
      await api(`/providers/${providerId}/transition`, { method: 'POST', body: JSON.stringify({ status }) });
      setNotice(status === 'suspended' ? 'Provider suspended.' : 'Provider restored.');
      setPendingSuspend(null);
      reload();
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function registerManifest(event) {
    event.preventDefault();
    if (!onboardId) return;
    setOnboardBusy(true);
    setNotice('');
    try {
      await api(`/providers/${encodeURIComponent(onboardId)}/onboarding`, {
        method: 'POST',
        body: JSON.stringify({ operations: ops, execution_classes: ['hardware', 'simulated'] }),
      });
      setNotice('Capability manifest registered.');
      setOnboardId('');
      reload();
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setOnboardBusy(false);
    }
  }

  function toggleOp(op) {
    setOps((prev) => (prev.includes(op) ? prev.filter((x) => x !== op) : [...prev, op]));
  }

  return (
    <GovernPageShell
      eyebrow="Resources"
      title="Providers & facilities"
      subtitle="Register capability manifests for dispatch eligibility. Suspended providers block hardware authorization."
      loading={loading && items.length === 0}
      error={error}
      notice={notice}
      onRetry={reload}
      onOpen={onOpen}
      loadingLabel="Loading providers…"
    >
      {items.length > 0 ? (
        <KpiStrip
          items={[
            { key: 'active', label: 'Active', value: items.filter((row) => row.status !== 'suspended').length },
            { key: 'susp', label: 'Suspended', value: items.filter((row) => row.status === 'suspended').length },
            { key: 'man', label: 'Manifest', value: items.filter((row) => row.integration?.manifest_registered).length },
            { key: 'nom', label: 'No manifest', value: items.filter((row) => !row.integration?.manifest_registered).length },
          ]}
        />
      ) : null}
      <form className="qre-card govern-dashboard-stack" onSubmit={registerManifest}>
        <div className="govern-section-head">
          <h3 className="govern-section-title">Register capability manifest</h3>
        </div>
        <label className="qre-field">
          <span className="qre-field__label">Provider</span>
          <select
            className="qre-field__input"
            value={onboardId}
            onChange={(e) => setOnboardId(e.target.value)}
            required
          >
            <option value="">Select provider…</option>
            {items.map((p) => (
              <option key={p.provider_id} value={p.provider_id}>
                {p.provider_name} ({p.provider_id})
              </option>
            ))}
          </select>
        </label>
        <fieldset className="govern-stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="qre-field__label">Declared operations</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {MANIFEST_OPS.map((op) => (
              <label key={op} className="govern-check">
                <input type="checkbox" checked={ops.includes(op)} onChange={() => toggleOp(op)} />
                {op}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="qre-btn qre-btn--primary" disabled={onboardBusy || ops.length === 0}>
          {onboardBusy ? 'Saving…' : 'Save manifest'}
        </button>
      </form>
      <div className="qre-card">
        {items.length > 0 ? (
          <div className="page-filters">
            <input
              className="govern-search"
              type="search"
              placeholder="Name, id, status…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Find provider"
            />
            <ListViewToolbar prefs={prefs} columns={PROVIDER_COLS} lockedIds={['name']} />
          </div>
        ) : null}
        {visible.length === 0 ? (
          <EmptyState
            title={items.length ? 'No providers match this search' : 'No providers in catalogue'}
            hint={
              items.length
                ? 'Clear the search to see the full catalogue.'
                : 'Provider rows come from the platform catalogue. Discovery seeds them on first Govern summary when the database is empty.'
            }
            action={
              items.length ? (
                <button type="button" className="qre-btn qre-btn--ghost" onClick={() => setQuery('')}>
                  Clear search
                </button>
              ) : (
                <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onOpen?.('#/connectors')}>
                  Open provider health
                </button>
              )
            }
          />
        ) : (
          <div className="govern-table-wrap">
            <table className="govern-table">
              <thead>
                <tr>
                  {prefs.isVisible('status') && <th>Status</th>}
                  {prefs.isVisible('name') && <th>Name</th>}
                  {prefs.isVisible('id') && <th>Provider ID</th>}
                  {prefs.isVisible('integration') && <th>Integration</th>}
                  {prefs.isVisible('actions') && <th />}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.provider_id}>
                    {prefs.isVisible('status') && (
                    <td>
                      <span className={`govern-status${row.status === 'suspended' ? ' govern-status--bad' : ' govern-status--ok'}`}>
                        {row.status === 'suspended' ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    )}
                    {prefs.isVisible('name') && (
                    <td>
                      <strong>{row.provider_name}</strong>
                    </td>
                    )}
                    {prefs.isVisible('id') && <td className="govern-muted">{row.provider_id}</td>}
                    {prefs.isVisible('integration') && (
                    <td className="govern-muted">
                      {row.integration?.manifest_registered
                        ? `Manifest · ${(row.integration.operations || []).join(', ') || 'no ops'}`
                        : 'No manifest'}
                    </td>
                    )}
                    {prefs.isVisible('actions') && (
                    <td>
                      {row.status === 'suspended' ? (
                        <button type="button" className="qre-btn qre-btn--ghost" onClick={() => setStatus(row.provider_id, 'active')}>
                          Restore
                        </button>
                      ) : (
                        <button type="button" className="qre-btn qre-btn--ghost" onClick={() => setPendingSuspend(row)}>
                          Suspend
                        </button>
                      )}
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ConfirmDialog
        title={pendingSuspend ? `Suspend ${pendingSuspend.provider_name}?` : ''}
        body={pendingSuspend ? 'Suspended providers block hardware authorization until they are restored.' : ''}
        confirmLabel="Suspend provider"
        danger
        onCancel={() => setPendingSuspend(null)}
        onConfirm={() => pendingSuspend && setStatus(pendingSuspend.provider_id, 'suspended')}
      />
    </GovernPageShell>
  );
}
