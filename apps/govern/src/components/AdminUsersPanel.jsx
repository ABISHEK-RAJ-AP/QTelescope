import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { EmptyState } from './ui.jsx';

function roleLabel(id) {
  if (!id) return '—';
  return String(id).replace(/_/g, ' ');
}

export default function AdminUsersPanel({ canAssign = false }) {
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyUser, setBusyUser] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    return Promise.all([api('/users'), api('/users/roles/catalog').catch(() => ({ roles: [] }))])
      .then(([users, catalog]) => {
        setRows(Array.isArray(users) ? users : []);
        setRoles(catalog?.roles || []);
      })
      .catch((e) => {
        setRows([]);
        setError(String(e.message || e));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const roleOptions = useMemo(() => {
    const seen = new Set();
    return (roles || [])
      .map((r) => r.id || r.role)
      .filter((id) => id && !seen.has(id) && seen.add(id));
  }, [roles]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...rows].sort((a, b) => String(a.username).localeCompare(String(b.username)));
    if (!q) return list;
    return list.filter((u) =>
      `${u.username} ${u.full_name || ''} ${u.email || ''} ${u.role || ''} ${u.org || ''}`.toLowerCase().includes(q),
    );
  }, [rows, query]);

  async function assignRole(username, role) {
    if (!canAssign) return;
    setBusyUser(username);
    const prev = rows;
    setRows((list) => list.map((u) => (u.username === username ? { ...u, role } : u)));
    try {
      await api(`/users/${encodeURIComponent(username)}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
    } catch (e) {
      setRows(prev);
      setError(String(e.message || e));
    } finally {
      setBusyUser('');
    }
  }

  if (loading && !rows.length && !error) {
    return <p className="govern-muted">Loading user directory…</p>;
  }

  if (error && !rows.length) {
    return (
      <EmptyState
        title="User directory unavailable"
        hint={error.includes('403') || error.toLowerCase().includes('denied')
          ? 'Listing users requires an admin role on the server (GET /api/v1/users).'
          : error}
        action={
          <button type="button" className="qre-btn qre-btn--ghost" onClick={load}>
            Retry
          </button>
        }
      />
    );
  }

  return (
    <div className="qre-card dashboard-card govern-stack">
      <div className="govern-section-head">
        <h3 className="dashboard-card-title">User directory</h3>
        <input
          className="govern-search"
          type="search"
          placeholder="Search users…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Find user"
        />
      </div>
      <p className="govern-muted" style={{ margin: 0 }}>
        Read from <span className="govern-mono">GET /api/v1/users</span>. Role changes need admin.
      </p>
      {error ? <p className="qre-alert" style={{ margin: 0 }}>{error}</p> : null}
      {visible.length === 0 ? (
        <EmptyState title="No users match" hint="Clear search or reload the directory." />
      ) : (
        <div className="govern-table-wrap">
          <table className="govern-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Org</th>
                <th>MFA</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => (
                <tr key={user.username}>
                  <td>
                    <strong>{user.username}</strong>
                    {user.full_name ? <span className="govern-table__sub">{user.full_name}</span> : null}
                  </td>
                  <td>
                    {canAssign && roleOptions.length ? (
                      <select
                        className="qre-field__input"
                        style={{ minWidth: 140 }}
                        value={user.role || roleOptions[0]}
                        disabled={busyUser === user.username}
                        onChange={(e) => assignRole(user.username, e.target.value)}
                      >
                        {roleOptions.map((id) => (
                          <option key={id} value={id}>
                            {roleLabel(id)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      roleLabel(user.role)
                    )}
                  </td>
                  <td>{user.org || '—'}</td>
                  <td>{user.mfa_enabled ? 'On' : 'Off'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}