import { useEffect } from 'react';

function isEditableTarget(target) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = target.getAttribute('type') || 'text';
    return !['button', 'submit', 'checkbox', 'radio'].includes(type);
  }
  return target.isContentEditable;
}

/**
 * @param {{ onSave?: () => void, onSimulate?: () => void, simulateEnabled?: boolean, disabled?: boolean }} opts
 */
export default function useStudioHotkeys({ onSave, onSimulate, simulateEnabled = false, disabled = false }) {
  useEffect(() => {
    if (disabled) return undefined;
    function onKeyDown(e) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (isEditableTarget(e.target) && e.key.toLowerCase() !== 's') return;

      if (e.key.toLowerCase() === 's' && onSave) {
        e.preventDefault();
        onSave();
        return;
      }
      if (e.key === 'Enter' && simulateEnabled && onSimulate) {
        e.preventDefault();
        onSimulate();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSave, onSimulate, simulateEnabled, disabled]);
}
