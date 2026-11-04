/** Q-Forge metrics rail — adapted from qniverse-module3 MetricsPanel. */

function topOutcome(counts) {
  const entries = Object.entries(counts || {});
  if (!entries.length) return '—';
  const [bit, n] = entries.sort((a, b) => b[1] - a[1])[0];
  return `${bit} (${n})`;
}

export default function SimMetricsPanel({ simResult, defaultShots = 1024 }) {
  if (!simResult) {
    return (
      <section className="qf-metrics" aria-label="Execution metrics">
        <header className="qf-metrics__head">Execution metrics</header>
        <p className="qf-metrics__empty">Run a simulation to see status, shots, and top outcomes.</p>
      </section>
    );
  }

  const counts = simResult.result?.counts || {};
  const status = simResult.status || 'unknown';
  const failed = status === 'failed';

  return (
    <section className="qf-metrics" aria-label="Execution metrics">
      <header className="qf-metrics__head">Execution metrics</header>
      <div className="qf-metrics__grid">
        <div className="qf-metrics__row">
          <span className="qf-metrics__label">Status</span>
          <span className={`qf-metrics__value${failed ? ' qf-metrics__value--err' : ' qf-metrics__value--ok'}`}>
            {status}
          </span>
        </div>
        <div className="qf-metrics__row">
          <span className="qf-metrics__label">Job</span>
          <span className="qf-metrics__value qf-metrics__mono">{simResult.job_id?.slice(0, 12) || '—'}</span>
        </div>
        <div className="qf-metrics__row">
          <span className="qf-metrics__label">Class</span>
          <span className="qf-metrics__value">{simResult.manifest?.execution_class || 'simulated'}</span>
        </div>
        <div className="qf-metrics__row">
          <span className="qf-metrics__label">Shots</span>
          <span className="qf-metrics__value">{simResult.manifest?.shots ?? defaultShots}</span>
        </div>
        <div className="qf-metrics__row">
          <span className="qf-metrics__label">Outcomes</span>
          <span className="qf-metrics__value">{Object.keys(counts).length}</span>
        </div>
        <div className="qf-metrics__row">
          <span className="qf-metrics__label">Top result</span>
          <span className="qf-metrics__value qf-metrics__value--accent">{topOutcome(counts)}</span>
        </div>
      </div>
      {Object.keys(counts).length > 0 && (
        <details className="qf-metrics__counts">
          <summary>Counts distribution</summary>
          <pre>{JSON.stringify(counts, null, 2)}</pre>
        </details>
      )}
      {simResult.error && <p className="qf-metrics__err">{simResult.error}</p>}
    </section>
  );
}
