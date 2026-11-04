import { useEffect, useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import {
  createProject,
  fetchStudioConfig,
  getProject,
  listCircuits,
  listProjects,
  patchProject,
  saveCircuit,
  simulate,
  compileCircuit,
  preflightCircuit,
  createSubmission,
  submitForReview,
  listExecutionTargets,
  getSimulationJob,
  getWorkloadTimeline,
  createExperimentReport,
  visualFromQasm,
  visualToQasm,
  fetchGatePalette,
  fetchStudioSummary,
} from './api.js';
import SourceEditor from './SourceEditor.jsx';
import SimHistogram from './SimHistogram.jsx';
import VisualCircuitEditor from './VisualCircuitEditor.jsx';
import SubmitWizard from './SubmitWizard.jsx';
import { Code2, CircuitBoard, Play, Send } from 'lucide-react';
import ShellLayout, { BackLink, buildBreadcrumbs } from './ShellLayout.jsx';
import BuildLandingPage from './pages/BuildLandingPage.jsx';
import BuildLoginPage from './pages/BuildLoginPage.jsx';
import BuildRegisterPage from './pages/BuildRegisterPage.jsx';
import HomeKpiStrip from './components/HomeKpiStrip.jsx';
import WorkloadTimeline from '@qre-theme/WorkloadTimeline.jsx';
import ProjectSettingsPanel from './components/ProjectSettingsPanel.jsx';
import HomeRecentActivity from './components/HomeRecentActivity.jsx';
import QuotaBanner from './components/QuotaBanner.jsx';
import StudioConsole, { nextConsoleLine } from './components/StudioConsole.jsx';
import StudioPageHero from './components/StudioPageHero.jsx';
import BuildContextBar from './components/BuildContextBar.jsx';
import WorkspaceIdeRail from './components/WorkspaceIdeRail.jsx';
import SimMetricsPanel from './components/SimMetricsPanel.jsx';
import SimResultDrawer from './components/SimResultDrawer.jsx';
import EmptyState from './components/EmptyState.jsx';
import { writeContextProjectId } from '@qre-theme/contextScope.js';
import useStudioHotkeys from './hooks/useStudioHotkeys.js';
import useDragHeight from './hooks/useDragHeight.js';

const WORKSPACE_TABS = [
  { id: 'source', label: 'Source', icon: Code2 },
  { id: 'visual', label: 'Circuit', icon: CircuitBoard },
  { id: 'simulate', label: 'Simulate', icon: Play },
  { id: 'submit', label: 'Submit', icon: Send },
];

function Home() {
  const [config, setConfig] = useState(null);
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState('');

  function load() {
    Promise.all([fetchStudioConfig(), listProjects(), fetchStudioSummary()])
      .then(([cfg, projs, sum]) => {
        setConfig(cfg);
        setProjects(projs);
        setSummary(sum);
      })
      .catch((e) => setErr(String(e)));
  }

  useEffect(() => {
    load();
    const onRole = () => load();
    window.addEventListener('qre-role-changed', onRole);
    return () => window.removeEventListener('qre-role-changed', onRole);
  }, []);

  async function onNew() {
    const p = await createProject({
      name: `Project ${projects.length + 1}`,
      template_id: 'blank_circuit',
    });
    setProjects((prev) => [p, ...prev]);
  }

  if (err) return <ShellLayout title="Build"><p style={{ color: 'var(--danger)' }}>{err}</p></ShellLayout>;

  return (
    <ShellLayout title={config?.display_name ?? 'Development Studio'} contextBar={<BuildContextBar />}>
      <div className="qre-studio-page">
        <div className="qre-studio-landing-in">
        <StudioPageHero
          eyebrow="Q-Forge workspace"
          title={config?.display_name ?? 'Q-Forge'}
          subtitle="Create circuit projects, simulate locally, compile with preflight, and package submissions from one studio."
          actions={
            <>
              <Link to="/landing" className="qre-btn qre-btn--ghost">
                Product tour
              </Link>
              <button type="button" onClick={onNew} className="qre-btn qre-btn--primary">
                New project
              </button>
            </>
          }
        />
        </div>

        <div className="qre-studio-landing-in qre-studio-landing-in--delay">
        <HomeKpiStrip summary={summary} />
        <HomeRecentActivity items={summary?.recent_activity} />
        </div>

        <section className="qf-home-section">
          <div className="qf-home-section__head">
            <h2>Your projects</h2>
            <button type="button" onClick={onNew} className="qre-btn qre-btn--ghost">
              New
            </button>
          </div>
          {projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              body="Create a blank circuit workspace to open the IDE — source editor, visual composer, simulate, and submit."
              action={
                <button type="button" onClick={onNew} className="qre-btn qre-btn--primary">
                  Create first project
                </button>
              }
            />
          ) : (
            <div className="qf-project-grid">
              {projects.map((p) => (
                <Link key={p.project_id} to={`/project/${p.project_id}`} className="qf-project-card">
                  <div className="qf-project-card__top">
                    <span className="qf-project-card__type">{p.project_type}</span>
                    {p.submission_lock ? <span className="qf-project-card__lock">Locked</span> : null}
                  </div>
                  <h3 className="qf-project-card__title">{p.name}</h3>
                  <p className="qf-project-card__meta">{p.slug}</p>
                  <span className="qf-project-card__cta">Open workspace →</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {config && (
          <section className="qf-home-section">
            <div className="qf-home-section__head">
              <h2>Studio capabilities</h2>
              <span className="qf-home-section__count">{config.features.length}</span>
            </div>
            <div className="qre-feature-grid">
              {config.features.map((f) => (
                <div key={f.id} className="qre-feature-card">
                  <div className="qre-feature-card__body">
                    <div className="qre-feature-card__meta">{f.category || 'feature'}</div>
                    <p className="qre-feature-card__title">{f.label}</p>
                    {f.description && (
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>{f.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </ShellLayout>
  );
}

function ProjectView() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [config, setConfig] = useState(null);
  const [source, setSource] = useState('');
  const [circuitId, setCircuitId] = useState(null);
  const [targets, setTargets] = useState([]);
  const [targetId, setTargetId] = useState('simulator_local');
  const [pipelineResult, setPipelineResult] = useState(null);
  const [simResult, setSimResult] = useState(null);
  const [tab, setTab] = useState('source');
  const [gatePalette, setGatePalette] = useState([]);
  const [visual, setVisual] = useState({ num_qubits: 2, columns: [] });
  const [submitResult, setSubmitResult] = useState(null);
  const [workloadTimeline, setWorkloadTimeline] = useState(null);
  const [simQuotaBlocked, setSimQuotaBlocked] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [consoleLines, setConsoleLines] = useState([]);
  const [consoleExpanded, setConsoleExpanded] = useState(true);
  const [resultOpen, setResultOpen] = useState(false);
  const [splitConsole, setSplitConsole] = useState(() => {
    try {
      return localStorage.getItem('qre_studio_split_console') === '1';
    } catch {
      return false;
    }
  });
  const { height: consoleHeight, onResizePointerDown: onConsoleResize } = useDragHeight('qre_studio_console_height', {
    defaultHeight: 220,
    min: 100,
    max: 520,
  });
  const { height: editorHeight, onResizePointerDown: onEditorResize } = useDragHeight('qre_studio_editor_height', {
    defaultHeight: 420,
    min: 240,
    max: 720,
  });
  const [err, setErr] = useState('');

  function appendLog(message, level = 'info') {
    setConsoleLines((prev) => [...prev.slice(-80), nextConsoleLine(message, level)]);
    setConsoleExpanded(true);
  }

  const timelineFilters = (
    <div className="qre-tabs" style={{ marginBottom: 12 }}>
      {[
        ['all', 'All'],
        ['governance', 'Governance'],
        ['development', 'Build'],
      ].map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={`qre-tab${timelineFilter === id ? ' qre-tab--active' : ''}`}
          onClick={() => setTimelineFilter(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const defaultShots = project?.settings?.simulation?.default_shots ?? config?.simulation?.default_shots ?? 1024;

  const locked = project?.submission_lock;

  useEffect(() => {
    writeContextProjectId(projectId);
  }, [projectId]);

  useEffect(() => {
    Promise.all([
      getProject(projectId),
      fetchStudioConfig(),
      listCircuits(projectId),
      listExecutionTargets(),
      fetchGatePalette(),
    ])
      .then(async ([p, cfg, circuits, tgts, palette]) => {
        setProject(p);
        setConfig(cfg);
        setTargets(tgts.targets || []);
        setGatePalette(palette.gates || cfg.gate_palette || []);
        const head = circuits.find((c) => c.is_head) || circuits[0];
        if (head) {
          setCircuitId(head.circuit_id);
          if (head.source_text) {
            setSource(head.source_text);
            try {
              const v = await visualFromQasm(head.source_text);
              setVisual(v);
            } catch {
              setVisual({ num_qubits: 2, columns: [] });
            }
          }
        }
      })
      .catch((e) => setErr(String(e)));
  }, [projectId]);

  function toggleCapability(featureId) {
    const next = { ...(project.capabilities || {}), [featureId]: !project.capabilities?.[featureId] };
    patchProject(projectId, { capabilities: { [featureId]: next[featureId] } }).then(setProject);
  }

  async function onSaveSource() {
    if (locked) return;
    try {
      await saveCircuit(projectId, source, tab === 'visual' ? 'openqasm2' : 'openqasm3');
      appendLog('Circuit version saved to project history.', 'success');
    } catch (e) {
      appendLog(`Save failed: ${e.message || e}`, 'error');
    }
  }

  async function applyVisualToSource() {
    const out = await visualToQasm(visual.num_qubits, visual.columns);
    setSource(out.source_text);
  }

  async function onVisualChange(nextColumns) {
    const next = { ...visual, columns: nextColumns };
    setVisual(next);
    const out = await visualToQasm(next.num_qubits, next.columns);
    setSource(out.source_text);
  }

  async function pollJob(jobId) {
    for (let i = 0; i < 40; i += 1) {
      const j = await getSimulationJob(jobId);
      if (j.status === 'completed' || j.status === 'failed') return j;
      await new Promise((r) => setTimeout(r, 250));
    }
    return getSimulationJob(jobId);
  }

  async function onSimulate() {
    const shots = project?.settings?.simulation?.default_shots ?? 1024;
    appendLog(`Starting simulation (${shots} shots)…`, 'info');
    try {
      const job = await simulate(projectId, shots);
      const finalJob = job.status === 'queued' || job.status === 'running' ? await pollJob(job.job_id) : job;
      setSimResult(finalJob);
      if (finalJob.status === 'failed') {
        appendLog(`Simulation failed: ${finalJob.error || finalJob.status}`, 'error');
      } else {
        appendLog(`Simulation completed · job ${finalJob.job_id?.slice(0, 8) ?? '—'}`, 'success');
        setResultOpen(true);
      }
      if (finalJob.workload_id) {
        const tl = await getWorkloadTimeline(finalJob.workload_id);
        setWorkloadTimeline(tl);
        setPipelineResult((prev) => ({ ...(prev || {}), timeline: tl.events }));
      }
    } catch (e) {
      appendLog(`Simulation error: ${e.message || e}`, 'error');
    }
  }

  async function refreshTimeline(workloadId) {
    if (!workloadId) return;
    const tl = await getWorkloadTimeline(workloadId);
    setWorkloadTimeline(tl);
  }

  async function onReport() {
    const rep = await createExperimentReport(projectId, {
      simulation_job_id: simResult?.job_id,
    });
    window.open(rep.download_path, '_blank');
  }

  async function onDryRunPreflight(execTargetId) {
    if (!circuitId || locked) return null;
    await onSaveSource();
    const compile = await compileCircuit(circuitId, { optimization_level: 1 });
    const pre = await preflightCircuit(circuitId, execTargetId || targetId);
    return { compile, pre };
  }

  function canReuseDryPipeline(dry) {
    return (
      dry?.compile?.run_id
      && dry?.pre?.report_id
      && dry.pre.status === 'passed'
      && dry.pre.execution_target_id === targetId
      && dry.compile.circuit_id === circuitId
    );
  }

  async function onCompilePreflightSubmit(dryPipeline) {
    if (!circuitId || locked) return;
    appendLog('Submitting package for governance review…', 'info');
    try {
      let compile;
      let pre;
      let reusedDryRun = false;
      if (canReuseDryPipeline(dryPipeline)) {
        compile = dryPipeline.compile;
        pre = dryPipeline.pre;
        reusedDryRun = true;
        appendLog('Reusing dry-run compile + preflight artifacts.', 'info');
      } else {
        if (!locked) await saveCircuit(projectId, source, tab === 'visual' ? 'openqasm2' : 'openqasm3');
        compile = await compileCircuit(circuitId, { optimization_level: 1 });
        pre = await preflightCircuit(circuitId, targetId);
        appendLog(`Compile ${compile.run_id?.slice(0, 8)} · preflight ${pre.status}`, pre.status === 'passed' ? 'success' : 'warn');
      }
      const sub = await createSubmission({
        project_id: projectId,
        circuit_id: circuitId,
        compilation_run_id: compile.run_id,
        preflight_report_id: pre.report_id,
      });
      const reviewed = await submitForReview(sub.submission_id);
      const refreshed = await getProject(projectId);
      setProject(refreshed);
      setSubmitResult({
        compile,
        pre,
        reviewed,
        governance_progress: reviewed.governance_progress,
        reused_dry_run: reusedDryRun,
      });
      setPipelineResult({ compile, pre, reviewed });
      appendLog(`Submitted · workload ${reviewed.workload_id?.slice(0, 8)} · ${reviewed.governance_state}`, 'success');
      if (reviewed.workload_id) await refreshTimeline(reviewed.workload_id);
    } catch (e) {
      appendLog(`Submit failed: ${e.message || e}`, 'error');
      throw e;
    }
  }

  useStudioHotkeys({
    onSave: locked ? undefined : onSaveSource,
    onSimulate: tab === 'simulate' && !simQuotaBlocked ? onSimulate : undefined,
    simulateEnabled: tab === 'simulate' && !simQuotaBlocked,
    disabled: !!locked,
  });

  if (err) return <ShellLayout title="Project"><p style={{ color: 'var(--danger)' }}>{err}</p></ShellLayout>;
  if (!project) return <ShellLayout title="Project"><p style={{ color: 'var(--text-muted)' }}>Loading…</p></ShellLayout>;

  const heroChips = [
    { label: project.project_type },
    { label: `${defaultShots.toLocaleString()} default shots` },
  ];
  if (locked) heroChips.push({ label: `Locked · ${locked.governance_state}`, variant: 'lock' });

  function toggleSplitConsole() {
    setSplitConsole((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('qre_studio_split_console', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const consolePanel = (
    <StudioConsole
      lines={consoleLines}
      expanded={consoleExpanded}
      onToggleExpanded={() => setConsoleExpanded((e) => !e)}
      onClear={() => setConsoleLines([])}
      bodyHeight={consoleHeight}
      onResizePointerDown={splitConsole ? undefined : onConsoleResize}
    />
  );

  return (
    <ShellLayout
      title={project.name}
      breadcrumbs={buildBreadcrumbs(project.name)}
      contextBar={<BuildContextBar projectId={projectId} projectName={project.name} />}
    >
      <div className={`qre-studio-page${splitConsole ? ' qre-studio-page--split' : ''}`}>
        <BackLink />
        <StudioPageHero
          eyebrow="Project IDE"
          title={project.name}
          subtitle="Source · visual circuit · simulate · compile & submit — one Q-Forge workspace."
          chips={heroChips}
          actions={
            <>
              <button type="button" onClick={toggleSplitConsole} className="qre-btn qre-btn--ghost">
                {splitConsole ? 'Stack console' : 'Dock console'}
              </button>
              {simResult && (
                <button type="button" onClick={() => setResultOpen(true)} className="qre-btn qre-btn--ghost">
                  Last results
                </button>
              )}
              {!locked && (
                <button type="button" onClick={onSaveSource} className="qre-btn qre-btn--primary">
                  Save circuit
                </button>
              )}
            </>
          }
        />

        {locked && (
          <p className="qre-alert">Submission lock active — edits disabled ({locked.governance_state}).</p>
        )}

        <SimResultDrawer
          open={resultOpen}
          onClose={() => setResultOpen(false)}
          simResult={simResult}
          defaultShots={defaultShots}
        />

        <div className="qre-studio-workstack">
          <div className="qre-studio-workstack__primary">
        <nav className="qre-studio-tabs" aria-label="Project workflow">
          {WORKSPACE_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`qre-studio-tab${tab === id ? ' qre-studio-tab--active' : ''}`}
            >
              <Icon size={16} aria-hidden />
              {label}
            </button>
          ))}
        </nav>

        <div className="qre-studio-layout qre-studio-layout--ide">
          <WorkspaceIdeRail
            tab={tab}
            circuitId={circuitId}
            projectName={project.name}
            gatePalette={gatePalette}
            locked={!!locked}
            onFocusSource={() => setTab('source')}
            onFocusVisual={() => setTab('visual')}
          />
          <div className="qre-studio-main">
            {tab === 'source' && (
              <section className="qre-studio-panel">
                <div className="qre-studio-panel__head">
                  <h2 className="qre-studio-panel__title">OpenQASM / source</h2>
                  <div className="qre-studio-panel__actions">
                    <button type="button" disabled={!!locked} onClick={onSaveSource} className="qre-btn qre-btn--ghost">
                      Save version
                    </button>
                  </div>
                </div>
                <div className="qre-studio-panel__body">
                  <div className="qre-editor-stack">
                    <SourceEditor
                      value={source}
                      onChange={locked ? () => {} : setSource}
                      language={project.project_type === 'sdk_python' ? 'python' : 'qasm'}
                      editorTheme={project.settings?.editor?.theme}
                      onSaveShortcut={locked ? undefined : onSaveSource}
                      height={editorHeight}
                    />
                    <div
                      className="qre-editor-stack__resize"
                      role="separator"
                      aria-orientation="horizontal"
                      aria-label="Resize editor"
                      onPointerDown={onEditorResize}
                    />
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 'var(--space-3) 0 0' }}>
                    Drag bar to resize · ⌘/Ctrl+S save · Simulate tab ⌘/Ctrl+Enter runs job
                  </p>
                </div>
              </section>
            )}

            {tab === 'visual' && (
              <section className="qre-studio-panel">
                <div className="qre-studio-panel__head">
                  <h2 className="qre-studio-panel__title">Circuit builder</h2>
                  <div className="qre-studio-panel__actions">
                    <label className="qre-field qre-field--row" style={{ margin: 0 }}>
                      <span className="qre-field__label">Qubits</span>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        disabled={!!locked}
                        className="qre-field__input"
                        style={{ width: 72 }}
                        value={visual.num_qubits}
                        onChange={(e) => setVisual({ ...visual, num_qubits: Number(e.target.value) })}
                      />
                    </label>
                    <button type="button" disabled={!!locked} onClick={applyVisualToSource} className="qre-btn qre-btn--ghost">
                      Sync QASM
                    </button>
                  </div>
                </div>
                <div className="qre-studio-panel__body">
                  <VisualCircuitEditor
                    gates={gatePalette}
                    numQubits={visual.num_qubits}
                    columns={visual.columns}
                    onChange={onVisualChange}
                    disabled={!!locked}
                  />
                </div>
              </section>
            )}

            {tab === 'simulate' && (
              <section className="qre-studio-panel">
                <div className="qre-studio-panel__head">
                  <h2 className="qre-studio-panel__title">Simulation</h2>
                  <div className="qre-studio-panel__actions">
                    <button type="button" onClick={onSimulate} disabled={simQuotaBlocked} className="qre-btn qre-btn--primary">
                      Run simulation
                    </button>
                    <button type="button" onClick={onReport} className="qre-btn qre-btn--ghost" disabled={!simResult}>
                      Report
                    </button>
                  </div>
                </div>
                <div className="qre-studio-panel__body qf-sim-layout">
                  <div className="qf-sim-layout__main">
                    <QuotaBanner shots={defaultShots} blockLabel onBlockedChange={setSimQuotaBlocked} />
                    {simResult?.result?.counts ? (
                      <div style={{ marginTop: 'var(--space-4)' }}>
                        <div className="qf-sim-layout__result-head">
                          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: 0 }}>
                            Results · {simResult.manifest?.execution_class ?? 'simulated'}
                          </h3>
                          <button type="button" className="qre-btn qre-btn--ghost" onClick={() => setResultOpen(true)}>
                            Expand results
                          </button>
                        </div>
                        <SimHistogram counts={simResult.result.counts} />
                      </div>
                    ) : (
                      <EmptyState
                        title="No simulation yet"
                        body="Save your circuit, then run simulation to populate histogram and metrics."
                      />
                    )}
                    <div style={{ marginTop: 'var(--space-5)' }}>
                      <h3 className="qre-studio-panel__title" style={{ marginBottom: 'var(--space-3)' }}>
                        Workload timeline
                      </h3>
                      <WorkloadTimeline timeline={workloadTimeline} filter={timelineFilter} filterSlot={timelineFilters} />
                    </div>
                  </div>
                  <SimMetricsPanel simResult={simResult} defaultShots={defaultShots} />
                </div>
              </section>
            )}

            {tab === 'submit' && (
              <div className="qre-studio-main" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                <SubmitWizard
                  locked={locked}
                  targetId={targetId}
                  onTargetChange={setTargetId}
                  targets={targets}
                  onRun={onCompilePreflightSubmit}
                  onDryRun={onDryRunPreflight}
                  circuitReady={!!circuitId}
                  result={submitResult}
                  disabled={!!locked}
                  defaultShots={defaultShots}
                />
                {(workloadTimeline || submitResult?.reviewed?.workload_id) && (
                  <section className="qre-studio-panel">
                    <div className="qre-studio-panel__head">
                      <h2 className="qre-studio-panel__title">Governance trail</h2>
                    </div>
                    <div className="qre-studio-panel__body">
                      <WorkloadTimeline timeline={workloadTimeline} filter={timelineFilter} filterSlot={timelineFilters} />
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>

          <aside className="qre-studio-rail">
            <details open>
              <summary>Simulation & editor</summary>
              <div style={{ marginTop: 'var(--space-3)' }}>
                <ProjectSettingsPanel
                  projectId={projectId}
                  settings={project.settings}
                  locked={locked}
                  onUpdated={setProject}
                  compact
                />
              </div>
            </details>
            <details>
              <summary>Platform capabilities</summary>
              <div style={{ marginTop: 'var(--space-3)', maxHeight: 240, overflowY: 'auto' }}>
                {config?.features.map((f) => (
                  <label key={f.id} className="qre-field qre-field--row">
                    <input
                      type="checkbox"
                      checked={!!project.capabilities?.[f.id]}
                      onChange={() => toggleCapability(f.id)}
                    />
                    <span className="qre-field__label">{f.label}</span>
                  </label>
                ))}
              </div>
            </details>
          </aside>
        </div>
          </div>
          {splitConsole && consolePanel}
        </div>
        {!splitConsole && consolePanel}
      </div>
    </ShellLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/landing" element={<BuildLandingPage />} />
      <Route path="/login" element={<BuildLoginPage />} />
      <Route path="/register" element={<BuildRegisterPage />} />
      <Route path="/" element={<Home />} />
      <Route path="/project/:projectId" element={<ProjectView />} />
    </Routes>
  );
}
