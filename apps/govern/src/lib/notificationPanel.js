let openPanel = null;

export function registerNotificationPanelOpener(fn) {
  openPanel = fn;
  return () => {
    if (openPanel === fn) openPanel = null;
  };
}

export function openNotificationPanel() {
  openPanel?.();
}