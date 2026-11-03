import { buildAuthHeaders } from '@qre-theme/auth.js';

const API = '/api/v1';

export function devHeaders() {
  return buildAuthHeaders();
}

export async function fetchStudioConfig() {
  const r = await fetch(`${API}/studio/config`, { headers: devHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchStudioSummary() {
  const r = await fetch(`${API}/studio/summary`, { headers: devHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchStudioQuota(shots = 1024) {
  const r = await fetch(`${API}/studio/quota-evaluate?shots=${encodeURIComponent(shots)}`, { headers: devHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchProjectSettingsSchema(projectId) {
  const r = await fetch(`${API}/projects/${projectId}/settings-schema`, { headers: devHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listProjects() {
  const r = await fetch(`${API}/projects`, { headers: devHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createProject(body) {
  const r = await fetch(`${API}/projects`, {
    method: 'POST',
    headers: devHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getProject(id) {
  const r = await fetch(`${API}/projects/${id}`, { headers: devHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function patchProject(id, body) {
  const r = await fetch(`${API}/projects/${id}`, {
    method: 'PATCH',
    headers: devHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listCircuits(projectId) {
  const r = await fetch(`${API}/circuits/project/${projectId}`, { headers: devHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function saveCircuit(projectId, sourceText, sourceLanguage = 'openqasm3') {
  const r = await fetch(`${API}/circuits/project/${projectId}`, {
    method: 'POST',
    headers: devHeaders(),
    body: JSON.stringify({ name: 'main', source_language: sourceLanguage, source_text: sourceText }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function compileCircuit(circuitId, body = {}) {
  const r = await fetch(`${API}/circuits/${circuitId}/compile`, {
    method: 'POST',
    headers: devHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function preflightCircuit(circuitId, executionTargetId = 'simulator_local') {
  const r = await fetch(`${API}/circuits/${circuitId}/preflight`, {
    method: 'POST',
    headers: devHeaders(),
    body: JSON.stringify({ execution_target_id: executionTargetId }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createSubmission(body) {
  const r = await fetch(`${API}/workload-submissions`, {
    method: 'POST',
    headers: devHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function submitForReview(submissionId) {
  const r = await fetch(`${API}/workload-submissions/${submissionId}/submit-for-review`, {
    method: 'POST',
    headers: devHeaders(),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function estimateCircuit(circuitId, body = {}) {
  const r = await fetch(`${API}/circuits/${circuitId}/estimate`, {
    method: 'POST',
    headers: devHeaders(),
    body: JSON.stringify({ execution_target_id: 'simulator_local', shots: 1024, ...body }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listExecutionTargets() {
  const r = await fetch(`${API}/execution-targets`, { headers: devHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function simulate(projectId, shots = 1024) {
  const r = await fetch(`${API}/simulation-jobs/project/${projectId}/simulate`, {
    method: 'POST',
    headers: devHeaders(),
    body: JSON.stringify({ shots }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getSimulationJob(jobId) {
  const r = await fetch(`${API}/simulation-jobs/${jobId}`, { headers: devHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getWorkloadTimeline(workloadId) {
  const r = await fetch(`${API}/workloads/${workloadId}/timeline`, { headers: devHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function visualFromQasm(sourceText) {
  const r = await fetch(`${API}/visual-circuit/from-qasm`, {
    method: 'POST',
    headers: devHeaders(),
    body: JSON.stringify({ source_text: sourceText }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function visualToQasm(numQubits, columns) {
  const r = await fetch(`${API}/visual-circuit/to-qasm`, {
    method: 'POST',
    headers: devHeaders(),
    body: JSON.stringify({ num_qubits: numQubits, columns }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchGatePalette() {
  const r = await fetch(`${API}/visual-circuit/gate-palette`, { headers: devHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createExperimentReport(projectId, body = {}) {
  const r = await fetch(`${API}/projects/${projectId}/experiment-reports`, {
    method: 'POST',
    headers: devHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
