function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-sm)' }}>{children}</div>
    </div>
  );
}

export default function PipelineSummary({ result, title = 'Pipeline summary' }) {
  if (!result) return null;
  const { compile, pre, reviewed } = result;
  const violations = pre?.violations || [];

  return (
    <div className="qre-card" style={{ marginTop: 12 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', marginTop: 0 }}>{title}</h3>
      {compile && (
        <Row label="Compile">
          Run <code>{compile.run_id?.slice(0, 8)}…</code> · {compile.status || 'completed'}
          {compile.tool && ` · ${compile.tool}`}
        </Row>
      )}
      {pre && (
        <Row label="Preflight">
          <span
            className={`qre-activity-pill qre-activity-pill--${
              pre.status === 'passed' || pre.status === 'ok' ? 'simulation' : 'submission'
            }`}
          >
            {pre.status}
          </span>
          {' · '}
          {pre.execution_class} · target {pre.execution_target_id}
          {violations.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 'var(--text-xs)' }}>
              {violations.slice(0, 5).map((v, i) => (
                <li key={i}>{v.message || v.code || JSON.stringify(v)}</li>
              ))}
            </ul>
          )}
        </Row>
      )}
      {reviewed && (
        <Row label="Submission">
          Workload <code>{reviewed.workload_id?.slice(0, 8)}…</code> · {reviewed.governance_state}
          {result.governance_progress?.current_stage?.label && ` · ${result.governance_progress.current_stage.label}`}
        </Row>
      )}
      {result.reused_dry_run && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--success)', margin: 0 }}>
          Reused dry-run compile + preflight artifacts (no duplicate backend runs).
        </p>
      )}
    </div>
  );
}
