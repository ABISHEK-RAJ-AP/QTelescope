/** Local-dev only: role headers + optional bootstrap demo logins (see backend/.env.example). */

export const DEV_HEADER_ROLES = ['Admin', 'QuantumOpsAdmin', 'Researcher', 'Operator', 'Viewer'];

const DEFAULT_DEMO = {
  Admin: { username: 'admin', password: 'quantum2026' },
  Operator: { username: 'user_researcher', password: 'quantum2026' },
};

/** Roles that map to seeded /auth/login accounts (captcha-only UX). */
export const DEMO_LOGIN_ROLES = Object.keys(DEFAULT_DEMO);

function envDemo(role) {
  const u = import.meta.env[`VITE_QRE_DEMO_${role.toUpperCase()}_USER`];
  const p = import.meta.env[`VITE_QRE_DEMO_${role.toUpperCase()}_PASS`];
  if (u && p) return { username: u, password: p };
  return DEFAULT_DEMO[role] || null;
}

export function demoCredentialsForRole(role) {
  return envDemo(role);
}

export function roleLabel(role) {
  const labels = {
    Admin: 'Platform admin',
    QuantumOpsAdmin: 'Quantum ops admin',
    Researcher: 'Researcher',
    Operator: 'Operator',
    Viewer: 'Viewer (read-only)',
  };
  return labels[role] || role;
}
