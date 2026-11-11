import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import {
  RBAC_CAPABILITY_COLUMNS,
  ROLE_DEFINITIONS,
  roleHasCapability,
} from '../../lib/permissions';
import { RoleAccessModal } from './RoleAccessModal.jsx';

/** Alias rows — same access as canonical role; hide in matrix to reduce noise. */
const HIDDEN_MATRIX_ROLES = new Set(['Researcher', 'Operator', 'Admin']);

function currentViewerRole() {
  try {
    const u = JSON.parse(localStorage.getItem('quantum_user') || 'null');
    return u?.role || null;
  } catch {
    return null;
  }
}

export function RoleMatrix({ canEditAccess = false }) {
  const [editRoleId, setEditRoleId] = useState(null);
  const [customRoleIds, setCustomRoleIds] = useState(() => new Set());
  const roles = useMemo(
    () => ROLE_DEFINITIONS.filter((r) => !HIDDEN_MATRIX_ROLES.has(r.id)),
    [],
  );
  const showEdit = canEditAccess && ['SuperAdmin', 'Admin', 'PlatformAdmin', 'SecurityAdmin', 'QuantumOpsAdmin'].includes(currentViewerRole());
  const showAccessCol = showEdit && customRoleIds.size > 0;

  useEffect(() => {
    if (!showEdit) return;
    api.getRolesCatalog()
      .then((cat) => {
        const ids = new Set(
          (cat?.roles || []).filter((r) => r.builtin === false).map((r) => r.id),
        );
        setCustomRoleIds(ids);
      })
      .catch(() => setCustomRoleIds(new Set()));
  }, [showEdit]);

  return (
    <section className="card admin-rbac-matrix" aria-label="Role capability matrix">
      <div className="admin-rbac-matrix__head">
        <div>
          <h3 className="admin-card-title">Role capability matrix</h3>
          <p className="page-hint">Effective access by role. Assign roles in the directory below. Built-in bundles are fixed — create a custom role under Security to tailor access.</p>
        </div>
      </div>
      <div className="table-container admin-rbac-matrix__scroll">
        <table className="custom-table admin-rbac-table">
          <thead>
            <tr>
              <th scope="col">Role</th>
              {RBAC_CAPABILITY_COLUMNS.map((c) => (
                <th key={c.id} scope="col" className="admin-rbac-table__cap">{c.label}</th>
              ))}
              {showAccessCol ? <th scope="col" className="admin-rbac-table__cap">Access</th> : null}
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
                {showAccessCol && customRoleIds.has(r.id) ? (
                  <td className="admin-rbac-table__cell">
                    <button type="button" className="btn btn-secondary btn--xs" onClick={() => setEditRoleId(r.id)}>
                      Edit access
                    </button>
                  </td>
                ) : showAccessCol ? <td className="admin-rbac-table__cell" aria-hidden /> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editRoleId && (
        <RoleAccessModal
          roleId={editRoleId}
          onClose={() => setEditRoleId(null)}
          onSaved={() => setEditRoleId(null)}
        />
      )}
    </section>
  );
}
