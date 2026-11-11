import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock,
  KeyRound,
  Trash2,
  Unplug,
  X,
} from 'lucide-react';
import {
  OPERATOR_NOTICES_EVENT,
  clearDismissedOperatorNotices,
  dismissOperatorNotice,
  getActiveOperatorNotices,
  markOperatorNoticesSeen,
  remindOperatorNoticeLater,
  unreadOperatorNoticeCount,
} from '../../lib/operatorNotices.js';
import './operator-notice-bell.css';

function runAction(navigate, action) {
  if (action.href) navigate(action.href);
  action.onClick?.();
}

function noticeIcon(notice) {
  const id = notice.id || '';
  if (id.includes('collector')) return AlertTriangle;
  if (id.includes('orphan') || id.includes('registry')) return Unplug;
  if (id.includes('telemetry')) return Clock;
  if (notice.variant === 'critical' || notice.variant === 'error') return AlertTriangle;
  if (notice.variant === 'warn') return Unplug;
  return Bell;
}

function toneClass(variant) {
  if (variant === 'critical' || variant === 'error') return 'is-crit';
  if (variant === 'warn') return 'is-warn';
  return 'is-info';
}

function actionIcon(label) {
  const l = String(label || '').toLowerCase();
  if (l.includes('integration')) return KeyRound;
  if (l.includes('collector')) return AlertTriangle;
  return null;
}

export function OperatorNoticeBell({ className = '' }) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState(() => getActiveOperatorNotices());
  const [unread, setUnread] = useState(() => unreadOperatorNoticeCount());

  const refresh = useCallback(() => {
    setNotices(getActiveOperatorNotices());
    setUnread(unreadOperatorNoticeCount());
  }, []);

  useEffect(() => {
    refresh();
    const onEvt = () => refresh();
    const onOpen = () => setOpen(true);
    window.addEventListener(OPERATOR_NOTICES_EVENT, onEvt);
    window.addEventListener('qts:open-notices', onOpen);
    return () => {
      window.removeEventListener(OPERATOR_NOTICES_EVENT, onEvt);
      window.removeEventListener('qts:open-notices', onOpen);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return undefined;
    markOperatorNoticesSeen();
    refresh();
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, refresh]);

  return (
    <div className={`op-notice-bell ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className="btn btn-secondary op-notice-bell__trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={15} aria-hidden />
        {unread > 0 ? <span className="op-notice-bell__badge">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      {open ? (
        <div className="op-notice-bell__panel" role="dialog" aria-label="Operator notifications">
          <header className="op-notice-bell__head">
            <span className="op-notice-bell__head-title">
              <Bell size={16} aria-hidden />
              Notifications
            </span>
            <button
              type="button"
              className="op-notice-btn op-notice-btn--ghost"
              onClick={() => {
                clearDismissedOperatorNotices();
                refresh();
              }}
            >
              <Trash2 size={14} aria-hidden />
              Clear done
            </button>
          </header>
          <ul className="op-notice-bell__list">
            {notices.length === 0 ? (
              <li className="op-notice-bell__empty">No active notices. Toasts and reminders appear here.</li>
            ) : notices.map((n) => {
              const Icon = noticeIcon(n);
              const tone = toneClass(n.variant);
              const primary = (n.actions || []).find((a) => a.href && !a.dismiss);
              const ActionIcon = primary ? actionIcon(primary.label) : null;
              return (
                <li key={n.id} className={`op-notice-bell__item ${tone}`}>
                  <div className="op-notice-bell__row">
                    <div className={`op-notice-bell__glyph ${tone}`} aria-hidden>
                      <Icon size={18} strokeWidth={2} />
                    </div>
                    <div className="op-notice-bell__copy">
                      <p className="op-notice-bell__title">{n.title}</p>
                      <p className="op-notice-bell__body">{n.body}</p>
                    </div>
                  </div>
                  <div className="op-notice-bell__toolbar">
                    {primary ? (
                      <button
                        type="button"
                        className="op-notice-btn op-notice-btn--primary"
                        onClick={() => {
                          runAction(navigate, primary);
                          if (primary.dismiss !== false) dismissOperatorNotice(n.id);
                          refresh();
                        }}
                      >
                        {ActionIcon ? <ActionIcon size={15} aria-hidden /> : null}
                        {primary.label}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="op-notice-btn op-notice-btn--icon"
                      title="Remind in 24 hours"
                      aria-label="Remind later"
                      onClick={() => {
                        remindOperatorNoticeLater(n.id);
                        refresh();
                      }}
                    >
                      <Clock size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="op-notice-btn op-notice-btn--icon"
                      title="Dismiss"
                      aria-label="Dismiss"
                      onClick={() => {
                        dismissOperatorNotice(n.id);
                        refresh();
                      }}
                    >
                      <X size={16} aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {notices.length > 0 ? (
            <footer className="op-notice-bell__foot">
              <button
                type="button"
                className="op-notice-btn op-notice-btn--ghost op-notice-btn--block"
                onClick={() => {
                  notices.forEach((item) => dismissOperatorNotice(item.id));
                  refresh();
                }}
              >
                <CheckCheck size={15} aria-hidden />
                Dismiss all
              </button>
            </footer>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
