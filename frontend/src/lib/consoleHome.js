import { landingPathForRole } from './permissions.js';
import { readSessionUser } from './sessionAuth.js';

/** Marketing home when signed out; role landing when a bearer session exists locally. */
export function consoleHomePath(user = readSessionUser()) {
  if (!user?.token) return '/';
  return landingPathForRole(user.role) || '/app/overview';
}