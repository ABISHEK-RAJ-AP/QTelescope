import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './confirmDialog.css';

/**
 * @param {{ dlg: { title, body, confirm, input?, required?, defaultText?, onConfirm }, busy?, onCancel, onConfirm?, danger? }} props
 * Pass onConfirm when dlg.onConfirm is set (AlertsEvents pattern).
 */
export function ConfirmDialog({ dlg, busy, onCancel, onConfirm, danger = false }) {
  const [text, setText] = useState(dlg?.defaultText || '');
  const ref = useRef(null);
  const confirmFn = onConfirm || dlg?.onConfirm;

  useEffect(() => {
    setText(dlg?.defaultText || '');
  }, [dlg?.title, dlg?.defaultText]);

  useEffect(() => {
    ref.current?.focus();
    const k = (e) => { if (e.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [busy, onCancel]);

  if (!dlg) return null;

  const isDanger = danger || dlg.danger;

  return createPortal(
    <div className="confirm-dialog-backdrop" role="presentation" onClick={() => !busy && onCancel()}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title">{dlg.title}</h3>
        <p id="confirm-dialog-body" className="confirm-dialog__body">{dlg.body}</p>
        {dlg.input && (
          <label className="confirm-dialog__field">{dlg.input}
            <textarea ref={ref} className="input-control" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        )}
        <div className="confirm-dialog__actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            type="button"
            ref={dlg.input ? undefined : ref}
            className={`btn btn-primary${isDanger ? ' confirm-dialog__confirm--danger' : ''}`}
            disabled={busy || (dlg.required && !text.trim())}
            onClick={() => confirmFn?.(text)}
          >
            {busy ? 'Working…' : dlg.confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
