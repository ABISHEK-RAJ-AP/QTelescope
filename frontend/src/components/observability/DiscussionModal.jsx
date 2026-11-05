import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RoleBadge } from '../../pages/opsShared.jsx';
import { formatIST } from '../../utils/time';
import './confirmDialog.css';
import './DiscussionModal.css';

export function DiscussionModal({
  open,
  onClose,
  title,
  comments = [],
  canComment,
  actorName,
  role,
  placeholder,
  busy,
  onPost,
}) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!open) setText('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, busy, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="confirm-dialog-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="confirm-dialog discussion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discussion-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="discussion-modal-title">{title}</h3>
        <div className="discussion-modal__list">
          {comments.length === 0 ? (
            <p className="page-hint">No comments yet.</p>
          ) : (
            <ul className="inc-comments">
              {comments.map((c, i) => (
                <li key={c.comment_id || i}>
                  <div className="inc-comments__head">
                    <b>{c.author || 'operator'}</b>
                    <RoleBadge role={c.role} />
                  </div>
                  <time>{c.created_at ? formatIST(c.created_at) : ''}</time>
                  <p>{c.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        {canComment ? (
          <form
            className="inc-comment-form"
            onSubmit={(e) => {
              e.preventDefault();
              const t = text.trim();
              if (!t || busy) return;
              Promise.resolve(onPost(t)).then(() => setText(''));
            }}
          >
            <label className="al-field">Add comment
              <textarea
                className="input-control"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder || 'Findings, hypothesis, next steps…'}
              />
            </label>
            <p className="page-hint">Posted as <b>{actorName}</b> · role <RoleBadge role={role} /></p>
            <div className="confirm-dialog__actions">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Close</button>
              <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
                {busy ? 'Posting…' : 'Post comment'}
              </button>
            </div>
          </form>
        ) : (
          <div className="confirm-dialog__actions">
            <p className="page-hint">Read-only — no comment permission.</p>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
