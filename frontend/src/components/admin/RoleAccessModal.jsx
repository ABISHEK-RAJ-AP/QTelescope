import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../services/api';
import { listPermissionsForRole, roleLabel } from '../../lib/permissions';

const LOCKED_BUILTIN = new Set(['SuperAdmin', 'Admin', 'PlatformAdmin']);

export function RoleAccessModal({ roleId, onClose, onSaved }) {
  const [catalog, setCatalog] = useState([]);
  const [allPerms, setAllPerms] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const meta = useMemo(() => catalog.find((r) => r.id === roleId), [catalog, roleId]);
  const builtin = meta?.builtin !== false;
  const locked = builtin && LOCKED_BUILTIN.has(roleId);
  const editable = !locked && !builtin;

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [cat, permRes] = await Promise.all([
        api.getRolesCatalog(),
        api.getRolePermissionCatalog().catch(() => ({ permissions: [] })),
      ]);
      const roles = cat?.roles || [];
      setCatalog(roles);
      setAllPerms(permRes?.permissions || []);
      const row = roles.find((r) => r.id === roleId);
      setLabel(row?.label || roleLabel(roleId));
      const ids = row?.permission_ids?.length
        ? row.permission_ids
        : listPermissionsForRole(roleId).filter((p) => !p.startsWith('*'));
      setSelected(new Set(ids));
    } catch (e) {
      setErr(e?.message || 'Could not load role.');
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (perm) => {
    if (!editable) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  };

  const save = async () => {
    if (!editable) return;
    setBusy(true);
    setErr('');
    try {
      await api.patchCustomRole(roleId, {
        id: roleId,
        label: label.trim() || roleId,
        permissions: [...selected].sort(),
      });
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e?.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const permRows = useMemo(() => {
    if (listPermissionsForRole(roleId).some((p) => p.startsWith('*'))) {
      return [{ id: '*', label: 'All platform capabilities', on: true, disabled: true }];
    }
    const source = editable ? allPerms : listPermissionsForRole(roleId);
    return source.map((perm) => ({
      id: perm,
      label: perm,
      on: editable ? selected.has(perm) : true,
      disabled: !editable,
    }));
  }, [roleId, allPerms, selected, editable]);

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal-card admin-modal-card--wide" role="dialog" aria-modal="true" aria-label={`Edit ${roleLabel(roleId)}`} onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">Edit access — {roleLabel(roleId)}</div>
          <button type="button" className="admin-modal-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="admin-modal-body">
          {loading ? <p className="page-hint">Loading…</p> : (
            <>
              {locked && (
                <p className="page-hint">Full platform administrators — fixed capability set. Assign this role per user in the directory.</p>
              )}
              {builtin && !locked && (
                <p className="page-hint">Built-in bundle — read-only here. Add a custom role under Security if you need a variant.</p>
              )}
              {editable && (
                <label className="admin-field" style={{ display: 'block', marginBottom: 12 }}>
                  <span className="admin-input-label">Display label</span>
                  <input className="input-control" value={label} onChange={(e) => setLabel(e.target.value)} />
                </label>
              )}
              {err && <p className="admin-field-error" role="alert">{err}</p>}
              <div className="admin-role-perms" aria-label="Permissions">
                {permRows.map((perm) => (
                  <label key={perm.id} className={`admin-role-perms__item${perm.on ? ' is-on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={perm.on}
                      disabled={perm.disabled}
                      onChange={() => toggle(perm.id)}
                    />
                    <span>{perm.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="admin-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          {editable && (
            <button type="button" className="btn btn-primary" disabled={busy || loading} onClick={save}>
              {busy ? 'Saving…' : 'Save access'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
