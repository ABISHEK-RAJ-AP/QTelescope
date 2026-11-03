const COLLAPSE_KEY = 'qre_sidebar_collapsed';
const GROUPS_KEY = 'qre_nav_groups_open';

export function readSidebarCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(value) {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function readNavGroupsOpen() {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeNavGroupsOpen(state) {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
