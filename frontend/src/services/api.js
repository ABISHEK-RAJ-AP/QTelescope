/** Same-origin /api/v1 — Vite dev server proxies to the FastAPI backend. */
import { emitSessionExpired, isPublicAuthEndpoint } from '../lib/sessionAuth.js';

export const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

function sessionAuthHeaders() {
  try {
    const raw = localStorage.getItem('quantum_user');
    if (!raw) return {};
    const user = JSON.parse(raw);
    const headers = {};
    if (user?.role) headers['X-User-Role'] = user.role;
    if (user?.token) headers.Authorization = `Bearer ${user.token}`;
    return headers;
  } catch {
    /* ignore */
  }
  return {};
}

export async function fetchApi(endpoint, options) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...sessionAuthHeaders(),
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let detail = `API Error ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      /* keep status text */
    }
    if (res.status === 401 && !isPublicAuthEndpoint(endpoint)) {
      emitSessionExpired('unauthorized');
    }
    throw new Error(detail);
  }

  return res.json();
}

export const api = {
  // Authentication & Security CAPTCHA
  getCaptcha: () => fetchApi('/auth/captcha'),
  verifyCaptcha: (captchaId, captchaCode) => fetchApi('/auth/verify-captcha', { method: 'POST', body: JSON.stringify({ captcha_id: captchaId, captcha_code: captchaCode }) }),
  login: (credentials) => fetchApi('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  loginMfa: (payload) => fetchApi('/auth/login/mfa', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPassword: (payload) => fetchApi('/auth/password/forgot', { method: 'POST', body: JSON.stringify(payload) }),
  resetPassword: (payload) => fetchApi('/auth/password/reset', { method: 'POST', body: JSON.stringify(payload) }),
  changePassword: (payload) => fetchApi('/users/me/password', { method: 'POST', body: JSON.stringify(payload) }),
  getMe: () => fetchApi('/auth/me'),
  register: (payload) => fetchApi('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  getConfigStatus: () => fetchApi('/auth/config-status'),
  logout: () => fetchApi('/auth/logout', { method: 'POST' }),
  getUserProfile: () => fetchApi('/users/me'),
  patchUserProfile: (body) => fetchApi('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
  getUserPreferences: () => fetchApi('/users/me/preferences'),
  patchUserPreferences: (body) => fetchApi('/users/me/preferences', { method: 'PATCH', body: JSON.stringify(body) }),
  listUsers: () => fetchApi('/users'),
  assignUserRole: (username, role) => fetchApi(`/users/${encodeURIComponent(username)}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  getMfaStatus: () => fetchApi('/users/me/mfa/status'),
  startMfaEnroll: () => fetchApi('/users/me/mfa/enroll/start', { method: 'POST' }),
  confirmMfaEnroll: (code) => fetchApi('/users/me/mfa/enroll/confirm', { method: 'POST', body: JSON.stringify({ code }) }),
  disableMfa: (code) => fetchApi('/users/me/mfa/disable', { method: 'POST', body: JSON.stringify({ code }) }),
  getRolesCatalog: () => fetchApi('/users/roles/catalog'),
  getMySessions: () => fetchApi('/users/me/sessions'),
  revokeOtherSessions: () => fetchApi('/users/me/sessions/revoke-others', { method: 'POST' }),
  revokeSession: (sessionId) => fetchApi(`/users/me/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
  getProvenance: () => fetchApi('/admin/provenance'),
  getCollectorHealth: () => fetchApi('/admin/collector-health'),
  getCollectorDlq: (limit = 30) => fetchApi(`/admin/collector-dlq?limit=${limit}`),
  getAdapterVerification: () => fetchApi('/admin/adapters/verification'),
  getFacilityMqttStatus: () => fetchApi('/admin/facility/mqtt-status'),

  // Admin & Summary
  getSummary: () => fetchApi('/admin/summary'),
  getDataSources: () => fetchApi('/admin/data-sources'),
  getSchedules: () => fetchApi('/admin/collection-schedules'),
  getCollectionSchedules: () => fetchApi('/admin/collection-schedules'),
  updateSchedule: (data) => fetchApi('/admin/collection-schedules', { method: 'PUT', body: JSON.stringify(data) }),
  updateCollectionSchedule: (id, data) => fetchApi('/admin/collection-schedules', { method: 'PUT', body: JSON.stringify({ schedule_id: id, ...data }) }),
  saveIbmToken: (token) => fetchApi('/admin/ibm-token', { method: 'POST', body: JSON.stringify({ token }) }),
  getCredentials: () => fetchApi('/admin/credentials'),
  saveCredentials: (providerId, data) => fetchApi('/admin/credentials', { method: 'POST', body: JSON.stringify({ provider_id: providerId, ...data }) }),
  triggerAutoDiscovery: () => fetchApi('/admin/auto-discover', { method: 'POST' }),
  runCollection: () => fetchApi('/admin/run-collection', { method: 'POST' }),
  purgeCollectorDlq: () => fetchApi('/admin/collector-dlq', { method: 'DELETE' }),
  getAlertRules: () => fetchApi('/admin/alert-rules'),
  createAlertRule: (data) => fetchApi('/admin/alert-rules', { method: 'POST', body: JSON.stringify(data) }),
  updateAlertRule: (ruleId, data) => fetchApi(`/admin/alert-rules/${ruleId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAlertRule: (ruleId) => fetchApi(`/admin/alert-rules/${ruleId}`, { method: 'DELETE' }),

  // Device capability sheets
  getDeviceCapabilityCoverage: () => fetchApi('/device-capabilities/coverage'),
  getDeviceCapabilities: ({
    backend_id,
    include_qubits = true,
    include_gates = true,
    include_jobs = false,
  } = {}) => {
    const q = new URLSearchParams();
    if (backend_id) q.set('backend_id', backend_id);
    q.set('include_qubits', String(include_qubits));
    q.set('include_gates', String(include_gates));
    q.set('include_jobs', String(include_jobs));
    return fetchApi(`/device-capabilities/devices?${q}`);
  },
  getDeviceCapability: (backendId, include_jobs = true) =>
    fetchApi(`/device-capabilities/devices/${encodeURIComponent(backendId)}?include_jobs=${include_jobs}`),

  // Backends
  getBackends: () => fetchApi('/backends'),
  getBackendsStatusAll: () => fetchApi('/backends/status-all'),
  getBackendDetail: (id) => fetchApi(`/backends/${id}`),
  getBackendStatus: (id) => fetchApi(`/backends/${id}/status`),
  getBackendTelemetry: (id) => fetchApi(`/backends/${id}/telemetry`),
  getBackendConnectivity: (id) => fetchApi(`/backends/${id}/connectivity`),
  getBackendTopology: (id) => fetchApi(`/backends/${id}/topology`),

  // Qubits
  getBackendQubits: (id) => fetchApi(`/backends/${id}/qubits`),
  getQubitDetail: (backendId, idx) => fetchApi(`/backends/${backendId}/qubits/${idx}`),
  getQubitHistory: (backendId, idx) => fetchApi(`/backends/${backendId}/qubits/${idx}/history`),

  // Calibration
  getCalibrations: () => fetchApi('/calibration'),
  getBackendCalibration: (id) => fetchApi(`/calibration/${id}`),
  getCalibrationHistory: (id) => fetchApi(`/calibration/${id}/history`),
  getCalibrationTimeline: (id, limit = 40) =>
    fetchApi(`/calibration/${id}/timeline?limit=${encodeURIComponent(limit)}`),

  // Drift
  getDriftSummaries: (metric = 't1') => fetchApi(`/drift?metric=${metric}`),
  getBackendDrift: (id, metric = 't1') => fetchApi(`/drift/${id}?metric=${metric}`),
  getQubitDrift: (id, idx, metric = 't1') => fetchApi(`/drift/${id}/qubits/${idx}?metric=${metric}`),
  getDriftAnalysis: (backendId, metric = 'T1', qubitIdx = 0, points = 10) => fetchApi(`/drift/${backendId}/qubits/${qubitIdx}?metric=${metric.toLowerCase()}&limit=${points}`),

  // Queues
  getQueues: () => fetchApi('/queues'),
  getBackendQueue: (id) => fetchApi(`/queues/${id}`),
  getQueueHistory: (id) => fetchApi(`/queues/${id}/history`),

  // Jobs
  getJobs: (backendId, status) => {
    const params = new URLSearchParams();
    if (backendId) params.append('backend_id', backendId);
    if (status) params.append('status', status);
    return fetchApi(`/jobs?${params.toString()}`);
  },
  getJobDetail: (id) => fetchApi(`/jobs/${id}`),
  getJobFailureAnalytics: (backendId) => {
    const q = backendId ? `?backend_id=${encodeURIComponent(backendId)}` : '';
    return fetchApi(`/jobs/analytics/failures${q}`);
  },

  // Health
  getBackendsHealth: () => fetchApi('/health/backends'),
  getBackendHealthDetail: (id) => fetchApi(`/health/backends/${id}`),
  getHealthVector: () => fetchApi('/health/vector'),
  getHealthExplainFleet: () => fetchApi('/health/explain'),
  getHealthExplainBackend: (backendId) => fetchApi(`/health/explain/${backendId}`),
  getHealthExplainQubit: (backendId, qubitIndex) =>
    fetchApi(`/health/explain/${backendId}/qubits/${qubitIndex}`),
  compareBackends: (backendIds) =>
    fetchApi('/health/compare', {
      method: 'POST',
      body: JSON.stringify({ backend_ids: backendIds }),
    }),
  getCoherence: () => fetchApi('/health/coherence'),
  getHealthModules: () => fetchApi('/health/modules'),
  quarantineQubit: (backendId, idx, reason) => fetchApi(`/health/qubits/${backendId}/${idx}/quarantine`, { method: 'POST', body: JSON.stringify({ reason: reason || '' }) }),
  releaseQubit: (backendId, idx) => fetchApi(`/health/qubits/${backendId}/${idx}/release`, { method: 'POST' }),
  applyHealthRouter: () => fetchApi('/health/router/apply', { method: 'POST' }),

  // Environment
  getEnvironment: () => fetchApi('/environment'),
  getEnvironmentTemplate: () => fetchApi('/environment/template'),
  importEnvironment: (payload) => fetchApi('/environment/import', { method: 'POST', body: JSON.stringify(payload) }),
  exportEnvironment: () => fetchApi('/environment/export'),
  getEnvironmentIngestStatus: () => fetchApi('/environment/ingest/status'),
  getEnvironmentAdapterStatus: () => fetchApi('/environment/adapter/status'),
  scanEnvironmentInbox: () => fetchApi('/environment/inbox/scan', { method: 'POST' }),
  ingestEnvironment: (payload) => fetchApi('/environment/ingest', { method: 'POST', body: JSON.stringify(payload) }),

  getClassicalInfra: (backendId) => fetchApi(`/infra/classical/${backendId}`),
  getFleetClassicalInfra: () => fetchApi('/infra/classical'),

  getFederatedSummary: () => fetchApi('/federated/summary'),
  getFederationStatus: () => fetchApi('/federated/status'),
  getFederationIdentity: () => fetchApi('/federated/identity'),

  getDeploymentProfile: () => fetchApi('/admin/deployment/profile'),
  getRetentionPolicy: () => fetchApi('/admin/retention/policy'),
  getSchedulerStatus: () => fetchApi('/admin/scheduler-status'),

  getAnomalySummary: (metric = 't1') =>
    fetchApi(`/anomalies/summary?metric=${encodeURIComponent(metric)}`),
  getQubitAnomalies: (backendId, qubitIndex, metric = 't1') =>
    fetchApi(`/anomalies/${backendId}/qubits/${qubitIndex}?metric=${encodeURIComponent(metric)}`),

  getReplayTimeline: (backendId, limit = 80) =>
    fetchApi(`/replay/${backendId}/timeline?limit=${limit}`),
  getReplayFrame: (backendId, index) => fetchApi(`/replay/${backendId}/frame/${index}`),

  getNoveltyAudit: () => fetchApi('/research/novelty-audit'),
  askEvidenceAssistant: (question) =>
    fetchApi('/research/ask', { method: 'POST', body: JSON.stringify({ question }) }),

  getOperationsCentre: () => fetchApi('/operations/centre'),
  getPlatformHealth: () => fetchApi('/operations/platform-health'),
  getOpsTimeline: (limit = 40) => fetchApi(`/operations/timeline?limit=${limit}`),
  getIncident: (id) => fetchApi(`/incidents/${encodeURIComponent(id)}`),
  getIncidents: (status) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const q = params.toString();
    return fetchApi(`/incidents${q ? `?${q}` : ''}`);
  },
  syncIncidents: () => fetchApi('/incidents/sync', { method: 'POST' }),
  acknowledgeIncident: (id, body) => fetchApi(`/incidents/${id}/acknowledge`, { method: 'POST', body: JSON.stringify(body || {}) }),
  investigateIncident: (id) => fetchApi(`/incidents/${id}/investigate`, { method: 'POST' }),
  resolveIncident: (id, notes) => fetchApi(`/incidents/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution_notes: notes || '' }) }),
  addIncidentComment: (id, text) =>
    fetchApi(`/incidents/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),

  // Alerts
  getAlerts: (status, severity) => {
    const params = new URLSearchParams({ limit: '500' }); // API default is 100, which undercounts active alerts
    if (status) params.append('status', status);
    if (severity) params.append('severity', severity);
    return fetchApi(`/alerts?${params.toString()}`);
  },
  getAlertsSummary: () => fetchApi('/alerts/summary'),
  getAlert: (id) => fetchApi(`/alerts/${encodeURIComponent(id)}`),
  addAlertComment: (id, text) =>
    fetchApi(`/alerts/${encodeURIComponent(id)}/comments`, { method: 'POST', body: JSON.stringify({ text }) }),
  acknowledgeAlert: (id, body = {}) => fetchApi(`/alerts/${id}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify(typeof body === 'string' ? { acknowledged_by: body } : body),
  }),
  resolveAlert: (id, notes = '') => fetchApi(`/alerts/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolution_notes: notes || '' }),
  }),

  // Reports
  exportReport: (reportType, format) => `${BASE_URL}/reports/export?report_type=${reportType}&format=${format}`,
  exportReportJson: (reportType) => fetchApi(`/reports/export?report_type=${reportType}&format=json`),
  exportBundle: () => fetchApi('/reports/bundle'),
  importBundle: (payload) => fetchApi('/reports/import', { method: 'POST', body: JSON.stringify(payload) }),

  createEvidenceSnapshot: (body) => fetchApi('/evidence/snapshots', { method: 'POST', body: JSON.stringify(body) }),
  listEvidenceSnapshots: () => fetchApi('/evidence/snapshots'),
  downloadEvidenceSnapshot: (id) => `${BASE_URL}/evidence/snapshots/${id}/download`,
  async downloadEvidenceSnapshotBlob(id) {
    const res = await fetch(`${BASE_URL}/evidence/snapshots/${id}/download`, {
      headers: { ...sessionAuthHeaders() },
    });
    if (!res.ok) {
      throw new Error(`Download failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  },

  getQueueAnalytics: () => fetchApi('/queues/analytics/summary'),

  getMetricRegistry: () => fetchApi('/metrics/registry'),
  getMetricCapabilities: () => fetchApi('/metrics/capabilities'),
  getMetricCoverage: () => fetchApi('/metrics/coverage'),
  getBackendMetricCoverage: (id) => fetchApi(`/metrics/coverage/${id}`),
};
