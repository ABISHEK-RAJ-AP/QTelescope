import { useEffect } from 'react';

function isTyping(target) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'TEXTAREA' || tag === 'INPUT' || target.isContentEditable;
}

/** Alt+Shift+A/C/R for approve / changes / reject when review panel is open. */
export default function useReviewHotkeys({ open, busy, onApprove, onChanges, onReject }) {
  useEffect(() => {
    if (!open || busy) return undefined;
    function onKeyDown(e) {
      if (!e.altKey || !e.shiftKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'a') {
        e.preventDefault();
        onApprove?.();
      } else if (k === 'c') {
        e.preventDefault();
        onChanges?.();
      } else if (k === 'r') {
        e.preventDefault();
        onReject?.();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onApprove, onChanges, onReject]);
}
