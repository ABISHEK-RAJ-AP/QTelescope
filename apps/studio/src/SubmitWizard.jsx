import { useEffect, useState } from 'react';
import QuotaBanner from './components/QuotaBanner.jsx';
import PipelineSummary from './components/PipelineSummary.jsx';

const STEPS = ['Review', 'Compile', 'Preflight', 'Package', 'Submit'];

export default function SubmitWizard({
  locked,
  targetId,
  onTargetChange,
  targets,
  onRun,
  onDryRun,
  result,
  disabled,
  defaultShots = 1024,
  circuitReady = true,
}) {
  const [step, setStep] = useState(0);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [dryRun, setDryRun] = useState(null);
  const [dryBusy, setDryBusy] = useState(false);
  const [dryErr, setDryErr] = useState('');

  useEffect(() => {
    setDryRun(null);
    setDryErr('');
  }, [targetId]);

  async function runDryRun() {
    if (!onDryRun || !circuitReady) return null;
    setDryBusy(true);
    setDryErr('');
    try {
      const out = await onDryRun(targetId);
      setDryRun(out);
      if (out?.pre?.status === 'failed') {
        setDryErr('Preflight failed — resolve violations before submitting.');
      }
      return out;
    } catch (e) {
      setDryErr(String(e));
      return null;
    } finally {
      setDryBusy(false);
    }
  }

  async function next() {
    if (step === 1) {
      const out = await runDryRun();
      if (!out || out?.pre?.status === 'failed') return;
      setStep(2);
      return;
    }
    if (step === STEPS.length - 1) {
      if (quotaBlocked) return;
      await onRun(dryRun);
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  const preflightFailed = dryRun?.pre?.status === 'failed';
  const governHref = result?.reviewed?.workload_id
    ? `/govern/#/queue/${encodeURIComponent(result.reviewed.workload_id)}`
    : null;

  return (
    <div className="qre-studio-panel">
      <div className="qre-studio-panel__head">
        <h2 className="qre-studio-panel__title">Submit for governance</h2>
      </div>
      <div className="qre-studio-panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="qre-wizard-steps">
        {STEPS.map((label, i) => {
          let cls = 'qre-wizard-step';
          if (i === step) cls += ' qre-wizard-step--current';
          else if (i < step) cls += ' qre-wizard-step--done';
          return (
            <span key={label} className={cls}>
              {i + 1}. {label}
            </span>
          );
        })}
      </div>
      {locked && (
        <p className="qre-alert">
          Submission locked ({locked.governance_state}). Circuit and project edits disabled until governance returns changes.
          {locked.workload_id && (
            <>
              {' '}
              <a href={`/govern/#/queue/${encodeURIComponent(locked.workload_id)}`} style={{ color: 'var(--primary)' }}>
                Open in Govern
              </a>
            </>
          )}
        </p>
      )}
      {step === 0 && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
          Pipeline runs compile → preflight → package → governance review. Estimated simulation budget:{' '}
          <strong>{defaultShots}</strong> shots (project default).
        </p>
      )}
      {step === 1 && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>
          Continue to run a <strong>dry-run</strong> compile + preflight against the selected target (no submission yet).
        </p>
      )}
      {step >= 1 && (
        <>
          <label className="qre-field">
            <span className="qre-field__label">Execution target</span>
            <select
              className="qre-field__input"
              value={targetId}
              onChange={(e) => onTargetChange(e.target.value)}
              disabled={disabled || !!locked}
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {step >= 2 && <QuotaBanner shots={defaultShots} onBlockedChange={setQuotaBlocked} />}
          {step >= 2 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="qre-btn qre-btn--ghost"
                disabled={dryBusy || !circuitReady || !!locked}
                onClick={runDryRun}
              >
                {dryBusy ? 'Running preflight…' : 'Re-run preflight dry-run'}
              </button>
              {!circuitReady && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Save a circuit version first.</span>
              )}
            </div>
          )}
          {dryErr && <p className="qre-alert" style={{ borderColor: 'var(--danger)' }}>{dryErr}</p>}
          {dryRun && <PipelineSummary result={dryRun} title="Dry-run preview" />}
        </>
      )}
      <button
        type="button"
        disabled={
          disabled
          || !!locked
          || dryBusy
          || !circuitReady
          || (step === STEPS.length - 1 && quotaBlocked)
          || (step === STEPS.length - 1 && preflightFailed)
          || (step === STEPS.length - 1 && !dryRun)
        }
        onClick={next}
        className="qre-btn qre-btn--primary"
      >
        {step === 1 ? (dryBusy ? 'Preflight…' : 'Run preflight dry-run') : step === STEPS.length - 1 ? 'Submit for governance review' : 'Continue'}
      </button>
      {result?.reviewed && (
        <div className="qre-alert" style={{ borderColor: 'var(--success)', background: 'color-mix(in srgb, var(--success) 10%, var(--surface))' }}>
          Submitted · state {result.reviewed.governance_state}
          {result.governance_progress?.current_stage?.label
            ? ` · stage ${result.governance_progress.current_stage.label}`
            : ''}
          {governHref && (
            <>
              {' · '}
              <a href={governHref} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                Open in Govern
              </a>
            </>
          )}
        </div>
      )}
      {result && <PipelineSummary result={result} title="Submitted pipeline" />}
      {result && (
        <details>
          <summary style={{ fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--text-muted)' }}>Raw pipeline JSON</summary>
          <pre className="qre-timeline__payload" style={{ maxHeight: 200 }}>{JSON.stringify(result, null, 2)}</pre>
        </details>
      )}
      </div>
    </div>
  );
}
