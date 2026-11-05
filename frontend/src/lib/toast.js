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
