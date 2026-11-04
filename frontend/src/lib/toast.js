import { toast } from 'react-toastify';

/** App-wide toasts (replaces inline flash banners). */
export function notifySuccess(message) {
  toast.success(message, { toastId: message.slice(0, 48) });
}

export function notifyError(message) {
  toast.error(message, { toastId: `err:${message.slice(0, 40)}` });
}

export function notifyInfo(message) {
  toast.info(message);
}

export function notifyWarn(message) {
  toast.warn(message);
}
