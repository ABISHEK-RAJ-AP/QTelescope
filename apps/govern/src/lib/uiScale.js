const KEY = 'qre_govern_ui_scale';
const STEPS = [90, 100, 110];

export function readUiScale() {
  const n = Number(localStorage.getItem(KEY) || 100);
  return STEPS.includes(n) ? n : 100;
}

export function applyUiScale(n) {
  const next = STEPS.includes(n) ? n : 100;
  localStorage.setItem(KEY, String(next));
  document.documentElement.dataset.uiScale = String(next);
  return next;
}

export function cycleUiScale(current) {
  const i = STEPS.indexOf(current);
  return applyUiScale(STEPS[(i + 1) % STEPS.length]);
}

export { STEPS as UI_SCALE_STEPS };
