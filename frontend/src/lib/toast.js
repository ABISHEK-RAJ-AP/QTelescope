import { createElement } from 'react';
import { toast } from 'react-toastify';
import { OperatorToastNotice } from '../components/ui/OperatorToastNotice.jsx';
import {
  dismissOperatorNotice,
  markOperatorToastShown,
  remindOperatorNoticeLater,
  shouldShowOperatorToast,
  upsertOperatorNotice,
} from './operatorNotices.js';

function operatorToastClass(variant) {
  const v = variant === 'critical' || variant === 'error' ? 'crit' : variant === 'warn' ? 'warn' : 'info';
  return `qts-toast qts-toast--operator qts-toast--operator-${v}`;
}

function simpleToastOpts(variant, opts = {}) {
  return {
    toastId: opts.toastId,
    icon: false,
    className: `qts-toast qts-toast--simple qts-toast--${variant}`,
    bodyClassName: 'qts-toast__body',
    progressClassName: 'qts-toast__progress',
    closeButton: true,
  };
}

/** Persisted operator notice + optional toast (replaces inline scope banners). */
export function notifyOperatorNotice({
  id,
  title,
  body,
  variant = 'info',
  actions = [],
  showToast = true,
  autoClose = 9000,
}) {
  if (!id) return;
  upsertOperatorNotice({ id, title, body, variant, actions });
  if (!showToast) return;
  if (!shouldShowOperatorToast(id, body)) return;

  const runAction = (action) => {
    if (action.dismiss) dismissOperatorNotice(id);
    if (action.href) window.location.assign(action.href);
    action.onClick?.();
    if (action.dismiss !== false) {
      markOperatorToastShown(id, body);
      toast.dismiss(id);
    }
  };

  markOperatorToastShown(id, body);

  toast(
    createElement(OperatorToastNotice, {
      title,
      body,
      actions,
      onAction: runAction,
      onRemindLater: () => {
        remindOperatorNoticeLater(id);
        toast.dismiss(id);
      },
    }),
    {
      toastId: id,
      type: 'default',
      icon: false,
      autoClose,
      closeOnClick: false,
      className: operatorToastClass(variant),
      bodyClassName: 'qts-toast__body qts-toast__body--rich',
      progressClassName: 'qts-toast__progress',
    },
  );
}

/** App-wide toasts (replaces inline flash banners). */
export function notifySuccess(message, opts = {}) {
  toast.success(message, simpleToastOpts('success', {
    toastId: opts.toastId || message.slice(0, 48),
  }));
}

export function notifyError(message, opts = {}) {
  toast.error(message, simpleToastOpts('error', {
    toastId: opts.toastId || `err:${message.slice(0, 40)}`,
  }));
}

export function notifyInfo(message, opts = {}) {
  toast.info(message, simpleToastOpts('info', { toastId: opts.toastId }));
}

export function notifyWarn(message, opts = {}) {
  toast.warn(message, simpleToastOpts('warn', {
    toastId: opts.toastId || `warn:${message.slice(0, 40)}`,
  }));
}

/** Optimistic actions — Undo before autoClose (default 8s). */
export function notifyWithUndo(message, onUndo, opts = {}) {
  const toastId = opts.toastId || `undo:${message.slice(0, 32)}`;
  toast.info(
    createElement(
      'div',
      { className: 'qts-toast-undo' },
      createElement('span', null, message),
      createElement(
        'button',
        {
          type: 'button',
          className: 'qts-toast-undo__btn',
          onClick: () => {
            onUndo?.();
            toast.dismiss(toastId);
          },
        },
        'Undo',
      ),
    ),
    {
      autoClose: opts.autoClose ?? 8000,
      closeOnClick: false,
      toastId,
      icon: false,
      className: 'qts-toast qts-toast--simple qts-toast--info',
      bodyClassName: 'qts-toast__body',
      progressClassName: 'qts-toast__progress',
    },
  );
}
