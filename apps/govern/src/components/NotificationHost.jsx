import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CheckCheck,
  Clock,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { subscribeToasts } from '../lib/toast.js';
import { registerNotificationPanelOpener } from '../lib/notificationPanel.js';
import { relativeTime } from '../lib/format.js';
import { NotifyItem, NotifyItemGroup } from './ui/notify-item.jsx';
import {
  GOVERN_NOTICES_EVENT,
  clearDismissedGovernNotices,
  dismissAllActiveGovernNotices,
  dismissGovernNotice,
  getActiveGovernNotices,
  markGovernNoticesSeen,
  remindGovernNoticeLater,
} from '../lib/governNotices.js';

const TTL = 9000;
const VISIBLE = 3;

const ICON = {
  ok: CheckCircle2,
  err: XCircle,
  warn: AlertTriangle,
};

function formatTime(iso) {
  try {
    return (
      relativeTime(iso)
      || new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  } catch {
    return '';
  }
}

function runAction(action) {
  if (action?.href) window.location.hash = action.href.replace(/^#/, '');
  action?.onClick?.();
}

export default function NotificationHost() {
  const [live, setLive] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notices, setNotices] = useState(() => getActiveGovernNotices());

  const refreshNotices = useCallback(() => {
    setNotices(getActiveGovernNotices());
  }, []);

  useEffect(() => registerNotificationPanelOpener(() => setPanelOpen(true)), []);

  useEffect(() => {
    if (!panelOpen) return;
    markGovernNoticesSeen();
    refreshNotices();
    const onKey = (e) => {
      if (e.key === 'Escape') setPanelOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panelOpen, refreshNotices]);

  useEffect(() => {
    refreshNotices();
    const onEvt = () => refreshNotices();
    window.addEventListener(GOVERN_NOTICES_EVENT, onEvt);
    return () => window.removeEventListener(GOVERN_NOTICES_EVENT, onEvt);
  }, [refreshNotices]);

  useEffect(() => {
    return subscribeToasts((item) => {
      setLive((prev) => [...prev.filter((x) => x.id !== item.id), item].slice(-VISIBLE));
      refreshNotices();
      window.setTimeout(() => {
        setLive((prev) => prev.filter((x) => x.id !== item.id));
      }, TTL);
    });
  }, [refreshNotices]);

  const unread = useMemo(
    () => notices.filter((n) => !n.seen).length,
    [notices],
  );

  function dismissLive(id) {
    setLive((prev) => prev.filter((x) => x.id !== id));
    dismissGovernNotice(id);
    refreshNotices();
  }

  function closePanel() {
    setPanelOpen(false);
  }

  return (
    <>
      {live.length > 0 ? (
        <div className="qre-notify-stack" aria-live="polite">
          {live.map((item) => {
            const Icon = ICON[item.tone] || AlertTriangle;
            return (
              <div
                key={item.id}
                className={`qre-notify-card qre-notify-card--${item.tone}`}
                role="status"
              >
                <div className="qre-notify-card__icon" aria-hidden>
                  <Icon size={18} strokeWidth={2} />
                </div>
                <div className="qre-notify-card__body">
                  <div className="qre-notify-card__meta">
                    <span className="qre-notify-card__app">{item.app}</span>
                    <span className="qre-notify-card__dot" aria-hidden>
                      ·
                    </span>
                    <span className="qre-notify-card__time">{formatTime(item.at)}</span>
                  </div>
                  <p className="qre-notify-card__title">{item.title}</p>
                  <p className="qre-notify-card__message">{item.message}</p>
                </div>
                <button
                  type="button"
                  className="qre-notify-card__close"
                  aria-label="Dismiss"
                  onClick={() => dismissLive(item.id)}
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
            );
          })}
          {notices.length > live.length ? (
            <button
              type="button"
              className="qre-notify-stack__more"
              onClick={() => setPanelOpen(true)}
            >
              <Bell size={14} aria-hidden />
              View all ({notices.length})
            </button>
          ) : null}
        </div>
      ) : null}

      {panelOpen ? (
        <div
          className="qre-notify-backdrop"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && closePanel()}
        >
          <div
            className="qre-notify-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="govern-notify-title"
          >
            <header className="qre-notify-panel__head">
              <div className="qre-notify-panel__head-main">
                <Bell size={18} aria-hidden />
                <h2 id="govern-notify-title" className="qre-notify-panel__title">
                  Notifications
                </h2>
                <span
                  className="qre-notify-panel__count"
                  aria-label={`${unread} unread`}
                >
                  {unread}
                </span>
              </div>
              <div className="qre-notify-panel__actions">
                <button
                  type="button"
                  className="qre-btn qre-btn--ghost qre-btn--sm"
                  onClick={() => {
                    clearDismissedGovernNotices();
                    refreshNotices();
                  }}
                >
                  <Trash2 size={14} aria-hidden />
                  Clear done
                </button>
                <button
                  type="button"
                  className="qre-notify-panel__close"
                  aria-label="Close"
                  onClick={closePanel}
                >
                  <X size={18} />
                </button>
              </div>
            </header>
            <div className="qre-notify-panel__list">
              {notices.length === 0 ? (
                <p className="qre-notify-panel__empty">
                  No active notices. Toasts and queue updates appear here.
                </p>
              ) : (
                <NotifyItemGroup>
                  {notices.map((n) => {
                    const tone =
                      n.variant === 'error' || n.tone === 'err'
                        ? 'err'
                        : n.variant === 'warn' || n.tone === 'warn'
                          ? 'warn'
                          : 'ok';
                    const primary = (n.actions || []).find((a) => a.href);
                    const footer = (
                      <div className="qre-notify-item__toolbar">
                        {primary ? (
                          <button
                            type="button"
                            className="qre-notify-item__btn qre-notify-item__btn--primary"
                            onClick={() => {
                              runAction(primary);
                              if (primary.dismiss !== false) {
                                dismissGovernNotice(n.id);
                                refreshNotices();
                              }
                              closePanel();
                            }}
                          >
                            {primary.label}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="qre-notify-item__btn qre-notify-item__btn--icon"
                          title="Remind in 24 hours"
                          aria-label="Remind later"
                          onClick={() => {
                            remindGovernNoticeLater(n.id);
                            refreshNotices();
                          }}
                        >
                          <Clock size={15} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="qre-notify-item__btn qre-notify-item__btn--icon"
                          aria-label="Dismiss"
                          onClick={() => {
                            dismissGovernNotice(n.id);
                            refreshNotices();
                          }}
                        >
                          <X size={15} aria-hidden />
                        </button>
                      </div>
                    );
                    return (
                      <NotifyItem
                        key={n.id}
                        tone={tone}
                        app={n.app}
                        title={n.title}
                        description={n.body}
                        time={formatTime(new Date(n.updatedAt || n.createdAt).toISOString())}
                        unread={!n.seen}
                        footer={footer}
                        source={n.source}
                      />
                    );
                  })}
                </NotifyItemGroup>
              )}
            </div>
            {notices.length > 0 ? (
              <footer className="qre-notify-panel__foot">
                <button
                  type="button"
                  className="qre-btn qre-btn--ghost qre-btn--sm qre-notify-panel__foot-btn"
                  onClick={() => {
                    dismissAllActiveGovernNotices();
                    refreshNotices();
                  }}
                >
                  <CheckCheck size={15} aria-hidden />
                  Dismiss all
                </button>
              </footer>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}