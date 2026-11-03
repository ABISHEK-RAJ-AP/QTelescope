import { ChevronDown, ChevronUp, Terminal } from 'lucide-react';

function formatTime(d) {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function StudioConsole({
  lines = [],
  onClear,
  expanded = true,
  onToggleExpanded,
  bodyHeight = 220,
  onResizePointerDown,
}) {
  return (
    <section className={`qre-console${expanded ? '' : ' qre-console--collapsed'}`} aria-label="Activity console">
      {expanded && onResizePointerDown && (
        <div
          className="qre-console__resize"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize console"
          onPointerDown={onResizePointerDown}
        />
      )}
      <div className="qre-console__head">
        <button
          type="button"
          className="qre-console__title-btn"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
        >
          <Terminal size={14} aria-hidden />
          Console
          {lines.length > 0 && <span className="qre-console__count">{lines.length}</span>}
          {expanded ? <ChevronDown size={14} aria-hidden /> : <ChevronUp size={14} aria-hidden />}
        </button>
        <div className="qre-console__head-actions">
          {lines.length > 0 && expanded && (
            <button type="button" className="qre-console__action" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
      </div>
      {expanded && (
      <div className="qre-console__body" style={{ maxHeight: bodyHeight }} role="log" aria-live="polite">
        {lines.length === 0 ? (
          <p className="qre-console__empty">Compile, simulate, and submit actions log here — saves, job status, and pipeline steps.</p>
        ) : (
          lines.map((line) => (
            <div key={line.id} className={`qre-console__line qre-console__line--${line.level || 'info'}`}>
              <span className="qre-console__time">{formatTime(line.at)}</span>
              <span className="qre-console__msg">{line.message}</span>
            </div>
          ))
        )}
      </div>
      )}
    </section>
  );
}

export function nextConsoleLine(message, level = 'info') {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, message, level, at: new Date() };
}
