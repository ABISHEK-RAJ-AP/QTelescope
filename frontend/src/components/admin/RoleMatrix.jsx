import React, { useMemo, useState } from 'react';
import {
  RBAC_CAPABILITY_COLUMNS,
  ROLE_DEFINITIONS,
  roleHasCapability,
} from '../../lib/permissions';

const MATRIX_ROLES = ROLE_DEFINITIONS;

export function RoleMatrix({ compact = false }) {
  const [expanded, setExpanded] = useState(!compact);
  const roles = useMemo(() => MATRIX_ROLES, []);

  return (
    <section className="card admin-rbac-matrix" aria-label="Role capability matrix">
      <div className="admin-rbac-matrix__head">
        <div>
          <h3 className="admin-card-title">Role capability matrix</h3>
          <p className="page-hint">Effective access by role. Assign roles in the directory below.</p>
        </div>
        {compact && (
          <button type="button" className="btn btn-secondary btn--xs" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Collapse' : 'Expand matrix'}
          </button>
        )}
      </div>
      {expanded && (
        <div className="table-container admin-rbac-matrix__scroll">
          <table className="custom-table admin-rbac-table">
            <thead>
              <tr>
                <th scope="col">Role</th>
                {RBAC_CAPABILITY_COLUMNS.map((c) => (
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
                  {RBAC_CAPABILITY_COLUMNS.map((c) => {
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
