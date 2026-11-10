import React, { useCallback, useMemo, useState } from 'react';
import {
  RBAC_CAPABILITY_COLUMNS,
  ROLE_DEFINITIONS,
  roleHasCapability,
} from '../../lib/permissions';

const MATRIX_ROLES = ROLE_DEFINITIONS;
const HIDDEN_COLS_KEY = 'qtelescope_rbac_hidden_columns';

function readHiddenColumns() {
  try {
    const raw = localStorage.getItem(HIDDEN_COLS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => RBAC_CAPABILITY_COLUMNS.some((c) => c.id === id)) : [];
  } catch {
    return [];
  }
}

function currentViewerRole() {
  try {
    const u = JSON.parse(localStorage.getItem('quantum_user') || 'null');
    return u?.role || null;
  } catch {
    return null;
  }
}

export function RoleMatrix({ compact = false }) {
  const [expanded, setExpanded] = useState(!compact);
  const [customize, setCustomize] = useState(false);
  const [hiddenCols, setHiddenCols] = useState(() => readHiddenColumns());
  const roles = useMemo(() => MATRIX_ROLES, []);
  const canCustomize = currentViewerRole() === 'SuperAdmin';

  const visibleColumns = useMemo(
    () => RBAC_CAPABILITY_COLUMNS.filter((c) => !hiddenCols.includes(c.id)),
    [hiddenCols],
  );

  const toggleColumn = useCallback((id) => {
    setHiddenCols((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const visible = RBAC_CAPABILITY_COLUMNS.filter((c) => !next.includes(c.id));
      if (visible.length === 0) return prev;
      localStorage.setItem(HIDDEN_COLS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetColumns = useCallback(() => {
    localStorage.removeItem(HIDDEN_COLS_KEY);
    setHiddenCols([]);
  }, []);

  return (
    <section className="card admin-rbac-matrix" aria-label="Role capability matrix">
      <div className="admin-rbac-matrix__head">
        <div>
          <h3 className="admin-card-title">Role capability matrix</h3>
          <p className="page-hint">Effective access by role. Assign roles in the directory below.</p>
        </div>
        <div className="admin-rbac-matrix__tools">
          {canCustomize && expanded && (
            <button type="button" className="btn btn-secondary btn--xs" onClick={() => setCustomize((v) => !v)}>
              {customize ? 'Done customizing' : 'Customize columns'}
            </button>
          )}
          {compact && (
            <button type="button" className="btn btn-secondary btn--xs" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Collapse' : 'Expand matrix'}
            </button>
          )}
        </div>
      </div>
      {expanded && customize && canCustomize && (
        <div className="admin-rbac-matrix__pick" role="group" aria-label="Visible capability columns">
          {RBAC_CAPABILITY_COLUMNS.map((c) => (
            <label key={c.id} className="admin-rbac-matrix__pick-item">
              <input
                type="checkbox"
                checked={!hiddenCols.includes(c.id)}
                onChange={() => toggleColumn(c.id)}
              />
              {c.label}
            </label>
          ))}
          <button type="button" className="fs-link" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }} onClick={resetColumns}>Show all</button>
        </div>
      )}
      {expanded && (
        <div className="table-container admin-rbac-matrix__scroll">
          <table className="custom-table admin-rbac-table">
            <thead>
              <tr>
                <th scope="col">Role</th>
                {visibleColumns.map((c) => (
                  <th key={c.id} scope="col" className="admin-rbac-table__cap">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    <div className="admin-rbac-table__role">{r.label}</div>
                    <div className="al-sub">{r.summary}</div>
                  </th>
                  {visibleColumns.map((c) => {
                    const on = roleHasCapability(r.id, c.permission);
                    return (
                      <td key={c.id} className="admin-rbac-table__cell" aria-label={`${r.label}: ${c.label}`}>
                        <span className={`admin-rbac-mark${on ? ' admin-rbac-mark--on' : ''}`} aria-hidden>{on ? '✓' : '—'}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
