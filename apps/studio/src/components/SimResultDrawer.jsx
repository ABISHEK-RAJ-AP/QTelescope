import { X } from 'lucide-react';
import SimHistogram from '../SimHistogram.jsx';

/** Modal results surface — adapted from qniverse-module3 ResultWindow. */
export default function SimResultDrawer({ open, onClose, simResult, defaultShots = 1024 }) {
  if (!open || !simResult) return null;

  const counts = simResult.result?.counts || {};
  const shots = simResult.manifest?.shots ?? defaultShots;
  const outcomes = Object.keys(counts).length;

  return (
    <div className="qf-result-overlay" role="dialog" aria-modal="true" aria-label="Simulation results" onClick={onClose}>
      <div className="qf-result-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="qf-result-drawer__head">
          <div>
            <p className="qf-result-drawer__eyebrow">Simulation complete</p>
            <h2 className="qf-result-drawer__title">Quantum execution results</h2>
          </div>
          <button type="button" className="qf-result-drawer__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="qf-result-drawer__body">
          <div className="qf-result-drawer__kpis">
            <article className="qf-result-kpi">
              <span>Status</span>
              <strong>{simResult.status}</strong>
            </article>
            <article className="qf-result-kpi">
              <span>Shots</span>
              <strong>{Number(shots).toLocaleString()}</strong>
            </article>
            <article className="qf-result-kpi">
              <span>Outcomes</span>
              <strong>{outcomes}</strong>
            </article>
            <article className="qf-result-kpi">
              <span>Execution</span>
              <strong>{simResult.manifest?.execution_class || 'simulated'}</strong>
            </article>
          </div>

          {outcomes > 0 && (
            <section className="qf-result-drawer__section">
              <h3>Histogram</h3>
              <SimHistogram counts={counts} />
            </section>
          )}

          {simResult.manifest && (
            <section className="qf-result-drawer__section">
              <h3>Job manifest</h3>
              <pre className="qf-result-drawer__pre">{JSON.stringify(simResult.manifest, null, 2)}</pre>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
