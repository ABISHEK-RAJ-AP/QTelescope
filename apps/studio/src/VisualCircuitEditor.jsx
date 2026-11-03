import { useMemo, useState } from 'react';

const DEFAULT_GATES = [
  { id: 'h', label: 'H', qubits: 1, color: '#4f46e5' },
  { id: 'x', label: 'X', qubits: 1, color: '#7c3aed' },
  { id: 'cx', label: 'CX', qubits: 2, color: '#b45309' },
  { id: 'measure', label: 'M', qubits: 1, color: '#0e7490' },
];

export default function VisualCircuitEditor({ gates, numQubits, columns, onChange, disabled }) {
  const palette = gates?.length ? gates : DEFAULT_GATES;
  const [pending, setPending] = useState(null);

  const wires = useMemo(() => Array.from({ length: numQubits }, (_, i) => i), [numQubits]);

  function addColumn(gateDef) {
    if (disabled) return;
    if (gateDef.qubits === 2) {
      setPending({ gate: gateDef.id, step: 'pick_control' });
      return;
    }
    onChange([...columns, { gate: gateDef.id, target: 0 }]);
  }

  function onWireClick(qubitIndex) {
    if (disabled || !pending) return;
    if (pending.step === 'pick_control') {
      setPending({ ...pending, step: 'pick_target', control: qubitIndex });
      return;
    }
    onChange([...columns, { gate: pending.gate, control: pending.control, target: qubitIndex }]);
    setPending(null);
  }

  const wireStroke = 'rgba(148, 163, 184, 0.45)';
  const accent = '#f0c14b';

  return (
    <div>
      <div className="qre-circuit-palette">
        {palette.map((g) => (
          <button
            key={g.id}
            type="button"
            disabled={disabled}
            onClick={() => addColumn(g)}
            className="qre-circuit-gate"
            style={{ backgroundColor: g.color || '#475569' }}
            title={`Add ${g.label} gate`}
          >
            {g.label}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled || columns.length === 0}
          onClick={() => onChange(columns.slice(0, -1))}
          className="qre-circuit-gate qre-circuit-gate--muted"
        >
          Undo
        </button>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: 8 }}>
          {columns.length} gate{columns.length === 1 ? '' : 's'}
        </span>
      </div>
      {pending && (
        <p className="qre-circuit-hint" role="status">
          {pending.step === 'pick_control' ? 'Select control qubit on the diagram' : 'Select target qubit'}
        </p>
      )}
      <div className={`qre-circuit-canvas${pending ? ' qre-circuit-canvas--interactive' : ''}`}>
        <svg width={Math.max(480, 88 + columns.length * 56)} height={numQubits * 52 + 32} role="img" aria-label="Quantum circuit diagram">
          {wires.map((q) => (
            <g key={q}>
              <text x={10} y={34 + q * 52} fill="rgba(226, 232, 240, 0.55)" fontSize={11} fontFamily="JetBrains Mono, monospace">
                q[{q}]
              </text>
              <line x1={48} y1={28 + q * 52} x2={88 + columns.length * 56} y2={28 + q * 52} stroke={wireStroke} strokeWidth={1.5} />
              <rect
                x={0}
                y={10 + q * 52}
                width={88 + columns.length * 56}
                height={36}
                fill="transparent"
                onClick={() => onWireClick(q)}
              />
            </g>
          ))}
          {columns.map((col, idx) => {
            const x = 80 + idx * 56;
            const ty = 28 + (col.target || 0) * 52;
            const gate = col.gate?.toUpperCase();
            if (col.gate === 'cx') {
              const cy = 28 + (col.control || 0) * 52;
              return (
                <g key={idx}>
                  <line x1={x} y1={cy} x2={x} y2={ty} stroke={accent} strokeWidth={2} />
                  <circle cx={x} cy={cy} r={7} fill={accent} />
                  <circle cx={x} cy={ty} r={11} fill="#0f2440" stroke={accent} strokeWidth={2} />
                  <text x={x} y={ty + 4} textAnchor="middle" fill="#fde68a" fontSize={12}>
                    ⊗
                  </text>
                </g>
              );
            }
            return (
              <g key={idx}>
                <rect x={x - 16} y={ty - 16} width={32} height={32} rx={6} fill="#1b3a6b" stroke="#6366f1" strokeWidth={1.5} />
                <text x={x} y={ty + 5} textAnchor="middle" fill="#e0e7ff" fontSize={12} fontWeight={700}>
                  {gate === 'MEASURE' ? 'M' : gate?.[0]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
