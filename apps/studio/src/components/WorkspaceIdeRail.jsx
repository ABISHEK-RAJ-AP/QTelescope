import { FileCode2, Layers } from 'lucide-react';

/**
 * Left IDE rail — qniverse Sidebar pattern adapted for Q-Forge:
 * circuit / source focus + gate palette peek (visual tab).
 */
export default function WorkspaceIdeRail({
  tab,
  circuitId,
  projectName,
  gatePalette = [],
  locked,
  onFocusSource,
  onFocusVisual,
}) {
  return (
    <aside className="qf-ide-rail" aria-label="Workspace explorer">
      <div className="qf-ide-rail__brand">
        <span className="qf-ide-rail__brand-mark" aria-hidden />
        <div>
          <strong>IDE</strong>
          <span className="qf-ide-rail__brand-sub">{projectName || 'Project'}</span>
        </div>
      </div>

      <div className="qf-ide-rail__section">
        <div className="qf-ide-rail__section-head">
          <span>Explorer</span>
        </div>
        <ul className="qf-ide-rail__files">
          <li>
            <button
              type="button"
              className={`qf-ide-rail__file${tab === 'source' ? ' is-active' : ''}`}
              onClick={onFocusSource}
            >
              <FileCode2 size={14} aria-hidden />
              <span>
                circuit.qasm
                <small>{circuitId ? circuitId.slice(0, 8) : 'unsaved'}</small>
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`qf-ide-rail__file${tab === 'visual' ? ' is-active' : ''}`}
              onClick={onFocusVisual}
            >
              <Layers size={14} aria-hidden />
              <span>
                visual.circuit
                <small>composer</small>
              </span>
            </button>
          </li>
        </ul>
      </div>

      <div className="qf-ide-rail__section">
        <div className="qf-ide-rail__section-head">
          <span>Gate palette</span>
          {locked ? <em>locked</em> : null}
        </div>
        <div className="qf-ide-rail__gates">
          {(gatePalette.length ? gatePalette : [{ id: 'h', label: 'H' }, { id: 'x', label: 'X' }, { id: 'cx', label: 'CX' }, { id: 'measure', label: 'M' }]).map(
            (g) => (
              <span key={g.id || g.label || g.symbol} className="qf-ide-rail__gate" title={g.name || g.label || g.id}>
                {g.symbol || g.label || g.id}
              </span>
            ),
          )}
        </div>
        <p className="qf-ide-rail__hint">Open Circuit tab to drag gates onto the canvas.</p>
      </div>
    </aside>
  );
}
