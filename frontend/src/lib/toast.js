import { createElement } from 'react';
import { toast } from 'react-toastify';

/** App-wide toasts (replaces inline flash banners). */
export function notifySuccess(message, opts = {}) {
  toast.success(message, { toastId: opts.toastId || message.slice(0, 48) });
}

export function notifyError(message, opts = {}) {
  toast.error(message, { toastId: opts.toastId || `err:${message.slice(0, 40)}` });
}

export function notifyInfo(message, opts = {}) {
  toast.info(message, { toastId: opts.toastId });
}

export function notifyWarn(message, opts = {}) {
  toast.warn(message, { toastId: opts.toastId || `warn:${message.slice(0, 40)}` });
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
    { autoClose: opts.autoClose ?? 8000, closeOnClick: false, toastId },
  );
}
