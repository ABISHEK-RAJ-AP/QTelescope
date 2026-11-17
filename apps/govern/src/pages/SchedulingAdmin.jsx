import { useEffect, useState } from 'react';
import { api } from '../api.js';
import GovernPageShell from '../components/GovernPageShell.jsx';
import { buildQrpBreadcrumbs } from '../nav/qrpNav.js';
import { EmptyState } from '../components/ui.jsx';

const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function SchedulingAdmin({ onOpen }) {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError('');
    api('/governance/scheduling-config')
      .then(setConfig)
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const configured = config?.configured;

  return (
    <GovernPageShell
      breadcrumbs={buildQrpBreadcrumbs('resource-ops', 'Scheduling policy')}
      title="Scheduling policy"
      subtitle="Institution business hours and blackout windows. Holds still use overlap checks until policy enforcement ships."
      loading={loading && !config && !error}
      error={error}
      onRetry={load}
      onOpen={onOpen}
      loadingLabel="Loading scheduling policy…"
    >
      <nav className="link-row page-related-nav" aria-label="Related" style={{ marginBottom: 12 }}>
        <button type="button" className="fs-link" onClick={() => onOpen?.('#/reservations')}>
          Holds & reservations
        </button>
      </nav>
      {!configured ? (
        <EmptyState
          title="No policy on file"
          hint="Platform operators can publish hours and blackouts with PUT /governance/scheduling-config (platform:manage). Enforcement in reservation FSM is not wired yet."
        />
      ) : (
        <div className="govern-stack">
          <div className="qre-card">
            <h3 className="dashboard-card-title">Scope</h3>
            <ul className="govern-simple-list">
              <li>
                <strong>Tenant</strong> {config.tenant_id || '—'}
              </li>
              <li>
                <strong>Facility</strong> {config.facility_id || 'Default (tenant-wide)'}
              </li>
              <li>
                <strong>Timezone</strong> {config.timezone}
              </li>
              {config.updated_at ? (
                <li>
                  <strong>Updated</strong> {config.updated_at}
                  {config.updated_by ? ` · ${config.updated_by}` : ''}
                </li>
              ) : null}
            </ul>
          </div>
          <div className="qre-card">
            <h3 className="dashboard-card-title">Weekday hours</h3>
            {Object.keys(config.weekday_hours || {}).length === 0 ? (
              <p className="govern-muted">No weekday slots configured.</p>
            ) : (
              <ul className="govern-simple-list">
                {WEEKDAY_ORDER.filter((d) => config.weekday_hours[d]).map((d) => (
                  <li key={d}>
                    <strong>{d.toUpperCase()}</strong> {config.weekday_hours[d].open} – {config.weekday_hours[d].close}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="qre-card">
            <h3 className="dashboard-card-title">Blackout dates</h3>
            {(config.blackout_dates || []).length === 0 ? (
              <p className="govern-muted">None listed.</p>
            ) : (
              <ul className="govern-simple-list">
                {config.blackout_dates.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="qre-card">
            <h3 className="dashboard-card-title">Blackout windows</h3>
            {(config.blackout_windows || []).length === 0 ? (
              <p className="govern-muted">None listed.</p>
            ) : (
              <ul className="govern-simple-list">
                {config.blackout_windows.map((w, i) => (
                  <li key={`${w.start}-${i}`}>
                    {w.start} → {w.end}
                    {w.reason ? ` — ${w.reason}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </GovernPageShell>
  );
}