const STORAGE_KEY = 'qts_onboarding_v1';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function getOnboardingRecord(username) {
  if (!username) return {};
  return readAll()[username] || {};
}

/** Set when a new account is registered — drives first-login wizard. */
export function markOnboardingPending(username) {
  if (!username) return;
  const all = readAll();
  all[username] = {
    ...all[username],
    status: 'pending',
    registeredAt: new Date().toISOString(),
  };
  writeAll(all);
}

export function completeOnboarding(username) {
  if (!username) return;
  const all = readAll();
  all[username] = {
    ...all[username],
    status: 'completed',
    completedAt: new Date().toISOString(),
  };
  writeAll(all);
}

export function shouldRunOnboarding(user) {
  const username = user?.username;
  if (!username) return false;
  const rec = getOnboardingRecord(username);
  return rec.status === 'pending';
}

export function markConsoleTourPending(username) {
  if (!username) return;
  const all = readAll();
  all[username] = {
    ...all[username],
    consoleTourPending: true,
  };
  writeAll(all);
}

export function consumeConsoleTourPending(username) {
  if (!username) return false;
  const all = readAll();
  const rec = all[username];
  if (!rec?.consoleTourPending) return false;
  all[username] = { ...rec, consoleTourPending: false };
  writeAll(all);
  return true;
}

export function resetOnboardingForUser(username) {
  if (!username) return;
  const all = readAll();
  delete all[username];
  writeAll(all);
  markOnboardingPending(username);
}
