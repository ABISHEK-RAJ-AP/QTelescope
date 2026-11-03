import { useEffect, useState } from 'react';
import { api } from '../api.js';
import InventoryCompatSummary from '../components/InventoryCompatSummary.jsx';
import GovernPageShell from '../components/GovernPageShell.jsx';
import { ConfirmDialog } from '../components/ui.jsx';

export default function InventoryDetail({ assetId, onBack }) {
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [compatReq, setCompatReq] = useState({ execution_class: 'hardware', asset_class: '' });
  const [compat, setCompat] = useState(null);
  const [pendingLife, setPendingLife] = useState('');

  function load() {
    setLoading(true);
    return api(`/inventory/assets/${encodeURIComponent(assetId)}`)
      .then(setAsset)
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [assetId]);

  async function runCompatibility() {
    setCompat(null);
    try {
      const body = {
        asset_id: assetId,
        execution_class: compatReq.execution_class || undefined,
        asset_class: compatReq.asset_class || undefined,
      };
      const result = await api('/inventory/compatibility', { method: 'POST', body: JSON.stringify(body) });
      setCompat(result);
    } catch (e) {
      setCompat({ eligible: false, reason_codes: ['REQUEST_FAILED'], detail: String(e.message || e) });
    }
  }

  async function transition(lifecycle_state) {
    setBusy(true);
    setNotice('');
    try {
      const updated = await api(`/inventory/assets/${encodeURIComponent(assetId)}/lifecycle`, {
        method: 'POST',
        body: JSON.stringify({ lifecycle_state }),
      });
      setAsset(updated);
      setNotice(`Lifecycle → ${lifecycle_state}`);
      setPendingLife('');
    } catch (e) {
      setNotice(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <GovernPageShell
      eyebrow="Resource inventory"
      title={asset?.native_asset_id ?? 'Resource'}
      subtitle={asset ? `${asset.asset_class} · ${asset.provider_id}` : undefined}
      loading={loading && !asset}
      error={error}
      notice={notice}
      onRetry={load}
      loadingLabel="Loading resource…"
      actions={
        <>
          <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onBack('#/inventory')}>
            Back
          </button>
          <button type="button" className="qre-btn qre-btn--ghost" onClick={() => onBack('#/pools')}>
            Virtual pools
          </button>
        </>
      }
    >
      {asset ? (
      <>
      <div className="qre-card">
        <dl className="govern-dl">
          <div>
            <dt>Asset ID</dt>
            <dd className="govern-mono">{asset.asset_id}</dd>
          </div>
          <div>
            <dt>Execution class</dt>
            <dd>{asset.execution_class}</dd>
          </div>
          <div>
            <dt>Lifecycle</dt>
            <dd>
              <span className="govern-status govern-status--ok">{asset.lifecycle_state || 'registered'}</span>
            </dd>
          </div>
          <div>
            <dt>Provenance</dt>
            <dd>{asset.provenance}</dd>
          </div>
          <div>
            <dt>Registered</dt>
            <dd>{asset.created_at ? new Date(asset.created_at).toLocaleString() : '—'}</dd>
          </div>
        </dl>
      </div>

      {(asset.allowed_transitions || []).length > 0 && (
        <div className="qre-card govern-stack">
          <h3 className="govern-section-title">Lifecycle</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {asset.allowed_transitions.map((st) => (
              <button
                key={st}
                type="button"
                className="qre-btn qre-btn--ghost"
                disabled={busy}
                onClick={() => (st === 'retired' || st === 'suspended' ? setPendingLife(st) : transition(st))}
              >
                → {st}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="qre-card govern-stack">
        <div className="govern-section-head">
          <h3 className="govern-section-title">Compatibility check</h3>
          <button type="button" className="qre-btn qre-btn--ghost" onClick={runCompatibility}>
            Evaluate
          </button>
        </div>
        <div className="govern-form-grid">
          <label className="qre-field">
            <span className="qre-field__label">Required execution class</span>
            <select
              className="qre-field__input"
              value={compatReq.execution_class}
              onChange={(e) => setCompatReq({ ...compatReq, execution_class: e.target.value })}
            >
              <option value="">Any</option>
              <option value="hardware">Hardware</option>
              <option value="simulated">Simulated</option>
            </select>
          </label>
          <label className="qre-field">
            <span className="qre-field__label">Required asset class</span>
            <input
              className="qre-field__input"
              value={compatReq.asset_class}
              onChange={(e) => setCompatReq({ ...compatReq, asset_class: e.target.value })}
              placeholder="Optional"
            />
          </label>
        </div>
        {compat && <InventoryCompatSummary result={compat} />}
        {compat && (
          <details style={{ marginTop: 12 }}>
            <summary className="govern-muted" style={{ fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              Raw compatibility JSON
            </summary>
            <pre className="govern-code-block" style={{ marginTop: 8 }}>
              {JSON.stringify(compat, null, 2)}
            </pre>
          </details>
        )}
      </div>
      <ConfirmDialog
        title={pendingLife ? `Move asset to ${pendingLife}?` : ''}
        body={
          pendingLife === 'retired'
            ? 'Retired assets stay in history and cannot be dispatched.'
            : pendingLife
              ? 'Suspended assets stay registered but block hardware authorization.'
              : ''
        }
        confirmLabel={`Set ${pendingLife || 'state'}`}
        danger
        onCancel={() => setPendingLife('')}
        onConfirm={() => pendingLife && transition(pendingLife)}
      />
      </>
      ) : null}
    </GovernPageShell>
  );
}
