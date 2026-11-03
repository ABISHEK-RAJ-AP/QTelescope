import { useEffect, useState } from 'react';
import { readContextTenantId } from '@qre-theme/contextScope.js';
import { api } from '../api.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import { EmptyState } from '../components/ui.jsx';

export default function Administration({ onOpen, me }) {
  const [boundary, setBoundary] = useState(null);
  const [release, setRelease] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError('');
    Promise.all([
      api('/governance/institution-boundary'),
      api('/governance/release-evidence').catch(() => null),
    ])
      .then(([b, rel]) => {
        setBoundary(b);
        setRelease(rel);
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const ctxTenant = readContextTenantId();

  return (
    <GovernPageShell
      eyebrow="Operations"
      title="Administration"
      subtitle="Institution boundary, tenant context, and platform access controls for this Govern workspace."
      loading={loading && !boundary}
      error={error}
      onRetry={load}
      onOpen={onOpen}
      loadingLabel="Loading institution boundary…"
    >
      {me ? (
        <div className="qre-card dashboard-card govern-stack">
          <h3 className="dashboard-card-title">Signed-in session</h3>
          <div className="govern-meta-grid">
            <div className="govern-meta-item">
              <dt>User</dt>
              <dd>{me.username || '—'}</dd>
            </div>
            <div className="govern-meta-item">
              <dt>Role</dt>
              <dd>{me.role_label || me.role || '—'}</dd>
            </div>
            <div className="govern-meta-item">
              <dt>Org</dt>
              <dd>{me.org || '—'}</dd>
            </div>
            <div className="govern-meta-item">
              <dt>Permissions</dt>
              <dd>{(me.permissions || []).length}</dd>
            </div>
          </div>
          {(me.permissions || []).length ? (
            <p className="govern-muted" style={{ margin: '12px 0 0', fontSize: 'var(--text-xs)' }}>
              {(me.permissions || []).slice(0, 16).join(' · ')}
              {(me.permissions || []).length > 16 ? ' · …' : ''}
            </p>
          ) : null}
        </div>
      ) : null}
      {boundary ? (
        <>
          <div className="qre-card dashboard-card govern-stack">
            <h3 className="dashboard-card-title">Institution boundary</h3>
            <div className="govern-meta-grid">
              <div className="govern-meta-item">
                <dt>Active tenant (API)</dt>
                <dd className="govern-mono">{boundary.active_tenant_id}</dd>
              </div>
              <div className="govern-meta-item">
                <dt>Context tenant (browser)</dt>
                <dd className="govern-mono">{ctxTenant || '—'}</dd>
              </div>
              <div className="govern-meta-item">
                <dt>Data scope</dt>
                <dd>{boundary.governance_data_scope || 'tenant_isolated'}</dd>
              </div>
              <div className="govern-meta-item">
                <dt>Local site</dt>
                <dd>{boundary.federation?.local_site_name || boundary.federation?.local_site_id || '—'}</dd>
              </div>
              <div className="govern-meta-item">
                <dt>Peer sites reporting</dt>
                <dd>
                  {boundary.federation?.peer_sites_reporting ?? '—'} / {boundary.federation?.peer_sites_configured ?? '—'}
                </dd>
              </div>
            </div>
            {boundary.federation?.disclaimer ? (
              <p className="govern-muted" style={{ marginTop: 'var(--space-4)' }}>
                {boundary.federation.disclaimer}
              </p>
            ) : null}
          </div>
          {!boundary.active_tenant_id && (
            <EmptyState
              title="No active tenant"
              hint="Set tenant context from Organizations & projects or via session headers in development."
            />
          )}

          {release ? (
            <div className="qre-card dashboard-card govern-stack">
              <h3 className="dashboard-card-title">Release evidence (S11)</h3>
              <p className="govern-muted" style={{ margin: 0 }}>
                Automated gate pointers for pilot readiness — not a substitute for the full release checklist.
              </p>
              <div className="govern-meta-grid">
                <div className="govern-meta-item">
                  <dt>ENFORCE_RBAC</dt>
                  <dd>{release.environment?.enforce_rbac ? 'true' : 'false'}</dd>
                </div>
                <div className="govern-meta-item">
                  <dt>Tenant isolation (approvals)</dt>
                  <dd>{release.automated_checks?.tenant_isolation_on_approvals ? 'verified in tests' : '—'}</dd>
                </div>
                <div className="govern-meta-item">
                  <dt>OD-QRP-02 quota dashboard</dt>
                  <dd>{release.automated_checks?.od_qrp_02_operational_quota_dashboard ? 'enabled' : 'charter deferred'}</dd>
                </div>
              </div>
              {release.automated_checks?.pytest_modules?.length ? (
                <ul className="govern-muted" style={{ margin: '12px 0 0', paddingLeft: 20, fontSize: 'var(--text-sm)' }}>
                  {release.automated_checks.pytest_modules.map((m) => (
                    <li key={m}>
                      <code>{m}</code>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </GovernPageShell>
  );
}
