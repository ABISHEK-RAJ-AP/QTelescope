import React from 'react';

const CircuitOutput = ({ circuitData }) => {
  const [viewType, setViewType] = React.useState('graphical'); // 'graphical' or 'ascii'

  if (!circuitData) {
    return (
      <div className="circuit-panel">
        <div className="header">CIRCUIT VISUALIZATION</div>
        <div className="circuit-placeholder">
          <p>Run code to generate circuit diagram</p>
        </div>
      </div>
    );
  }

  // --- RENDER ASCII ---
  if (viewType === 'ascii' && circuitData.circuit_diagram) {
    const diagramLines = circuitData.circuit_diagram.split('\n');

    // Detect max label width to perform the split
    // Look for lines starting with "q...:" or "c...:"
    let splitIndex = 0;
    const labelRegex = /^(\s*[\w\[\]]+:\s)/;

    for (const line of diagramLines) {
      const match = line.match(labelRegex);
      if (match) {
        splitIndex = Math.max(splitIndex, match[1].length);
      }
    }

    // Fallback if no specific labels found (just render normally)
    if (splitIndex === 0) {
      return (
        <div className="circuit-panel">
          <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>CIRCUIT VISUALIZATION</span>
            <button className="btn-small" style={{ width: 'auto' }} onClick={() => setViewType('graphical')}>Switch to Graphical</button>
          </div>
          <div className="circuit-content" style={{ alignItems: 'flex-start', padding: 20, overflow: 'auto', background: '#1e1e1e' }}>
            <pre style={{ fontFamily: "'Cascadia Code', 'Consolas', monospace", fontSize: '13px', lineHeight: '1.2', color: '#d4d4d4', margin: 0 }}>
              {circuitData.circuit_diagram}
            </pre>
          </div>
        </div>
      );
    }

    // Split lines
    const leftLines = diagramLines.map(line => line.slice(0, splitIndex).padEnd(splitIndex, ' '));
    const rightLines = diagramLines.map(line => line.slice(splitIndex));

    return (
      <div className="circuit-panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>CIRCUIT VISUALIZATION</span>
          <button className="btn-small" style={{ width: 'auto', padding: '2px 8px' }} onClick={() => setViewType('graphical')}>Switch to Graphical</button>
        </div>

        {/* SPLIT LAYOUT ASCII */}
        <div className="circuit-container" style={{ display: 'flex', flex: 1, overflow: 'hidden', background: '#1e1e1e' }}>
          {/* LEFT STICKY */}
          <div className="circuit-labels" style={{
            flexShrink: 0,
            borderRight: '1px solid #333',
            background: '#252526',
            padding: '20px 0 20px 10px', // Math top/bottom padding of content
            overflow: 'hidden'
          }}>
            <pre style={{ fontFamily: "'Cascadia Code', 'Consolas', monospace", fontSize: '13px', lineHeight: '1.2', color: '#d4d4d4', margin: 0 }}>
              {leftLines.join('\n')}
            </pre>
          </div>

          {/* RIGHT SCROLLABLE */}
          <div className="circuit-scroll" style={{ flexGrow: 1, overflow: 'auto', padding: '20px 0 20px 0' }}>
            <pre style={{ fontFamily: "'Cascadia Code', 'Consolas', monospace", fontSize: '13px', lineHeight: '1.2', color: '#d4d4d4', margin: 0 }}>
              {rightLines.join('\n')}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER GRAPHICAL (SVG) ---
  const numQubits = circuitData.num_qubits || 2;
  const numClbits = circuitData.num_clbits || 2;
  const ops = circuitData.ops || [];

  // Layout Constants
  const stepSize = 50;
  const lineGap = 40;
  // Left pane width for labels
  const labelWidth = 60;
  // Top padding
  const startY = 40;

  // Right pane calculations
  const gateStartX = 20; // Start drawing gates a bit inward in the scrollable area
  const endPadding = 60;

  // --- COMPACT LAYOUT ENGINE ---
  // Tracks the next available column index for each qubit
  const qubitTracker = new Array(numQubits).fill(0);

  // Calculate horizontal positions (columns) for each gate
  const positionedOps = ops.map(op => {
    // Identify all qubits involved in this operation (targets + controls)
    const involvedQubits = [
      ...(op.targets || []),
      ...(op.controls || [])
    ];

    // Find the first available column where ALL involved qubits are free
    let startCol = 0;
    involvedQubits.forEach(q => {
      if (q < numQubits) {
        startCol = Math.max(startCol, qubitTracker[q]);
      }
    });

    // Update tracker for these qubits to point to the next column
    involvedQubits.forEach(q => {
      if (q < numQubits) {
        qubitTracker[q] = startCol + 1;
      }
    });

    return { ...op, col: startCol };
  });

  const totalCols = Math.max(...qubitTracker, 1);

  const classicalY = startY + numQubits * lineGap + 20;

  // Width of the SCROLLABLE content only
  const contentWidth = gateStartX + totalCols * stepSize + endPadding;
  const contentHeight = classicalY + 40;

  // The right SVG needs to be wide enough for content
  const scrollWidth = Math.max(contentWidth, 400);
  const totalHeight = Math.max(contentHeight, 250);

  // Helper to determine gate color
  const getGateColor = (name) => {
    const n = name.toUpperCase();
    if (['H'].includes(n)) return '#0e639c'; // Blue
    if (['X', 'Y', 'Z', 'RX', 'RY', 'RZ'].includes(n)) return '#b45a00'; // Orange
    if (['MEASURE', 'M'].includes(n)) return '#595959'; // Gray
    if (['BARRIER'].includes(n)) return '#666';
    if (['SWAP'].includes(n)) return '#002d9c';
    return '#6929c4'; // Purple (Phase, T, S, U, etc.)
  };

  return (
    <div className="circuit-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>CIRCUIT VISUALIZATION</span>
        {circuitData.circuit_diagram && (
          <button className="btn-small" style={{ width: 'auto', padding: '2px 8px' }} onClick={() => setViewType('ascii')}>View ASCII</button>
        )}
      </div>

      {/* SPLIT LAYOUT CONTAINER */}
      <div className="circuit-container" style={{ display: 'flex', flex: 1, overflow: 'hidden', background: '#1e1e1e' }}>

        {/* LEFT STICKY PANE (Labels) */}
        <div className="circuit-labels" style={{
          width: `${labelWidth}px`,
          flexShrink: 0,
          borderRight: '1px solid #333',
          background: '#252526', // Slightly lighter to distinguish
          zIndex: 10
        }}>
          <svg width={labelWidth} height={totalHeight} style={{ display: 'block' }}>
            {/* Labels for Qubits */}
            {Array.from({ length: numQubits }).map((_, i) => (
              <text key={`qlab-${i}`} x="50" y={startY + i * lineGap + 5} fill="#d4d4d4" fontSize="12" fontFamily="monospace" fontWeight="bold" textAnchor="end">q[{i}]</text>
            ))}
            {/* Label for Classical */}
            <text x="50" y={classicalY + 5} fill="#aaa" fontSize="12" fontFamily="monospace" fontWeight="bold" textAnchor="end">c[{numClbits}]</text>
          </svg>
        </div>

        {/* RIGHT SCROLLABLE PANE (Circuit) */}
        <div className="circuit-scroll" style={{ flexGrow: 1, overflow: 'auto' }}>
          <svg
            width={scrollWidth}
            height={totalHeight}
            viewBox={`0 0 ${scrollWidth} ${totalHeight}`}
            style={{ display: 'block', minWidth: scrollWidth }}
          >
            {/* 1. Wires (Full Width in Scroll Pane) */}
            {Array.from({ length: numQubits }).map((_, i) => (
              <line key={`qw-${i}`} x1={0} y1={startY + i * lineGap} x2={scrollWidth} y2={startY + i * lineGap} stroke="#555" strokeWidth="1.5" />
            ))}
            {/* Classical Lines */}
            <line x1={0} y1={classicalY - 2} x2={scrollWidth} y2={classicalY - 2} stroke="#777" strokeWidth="1" />
            <line x1={0} y1={classicalY + 2} x2={scrollWidth} y2={classicalY + 2} stroke="#777" strokeWidth="1" />

            {/* 2. Gates */}
            {positionedOps.map((op, index) => {
              // Use calculated column for X position
              const xPos = gateStartX + op.col * stepSize;
              let gateColor = getGateColor(op.gate);

              // A. BARRIER
              if (op.gate === 'BARRIER') {
                return (
                  <g key={`gate-${index}`}>
                    <line x1={xPos} y1={startY - 10} x2={xPos} y2={classicalY - 10} stroke="#666" strokeWidth="1" strokeDasharray="4" />
                  </g>
                );
              }

              // B. MEASUREMENT
              if (op.gate === 'MEASURE') {
                const target = op.targets[0];
                const cTarget = op.c_targets ? op.c_targets[0] : 0;
                const yPos = startY + target * lineGap;
                return (
                  <g key={`gate-${index}`}>
                    <line x1={xPos + 15} y1={yPos} x2={xPos + 15} y2={classicalY} stroke="#555" strokeWidth="1" />
                    <rect x={xPos} y={yPos - 15} width="30" height="30" fill="#2d2d2d" stroke="#d4d4d4" strokeWidth="1" />
                    <text x={xPos + 15} y={yPos + 5} fill="#d4d4d4" fontSize="12" fontWeight="bold" textAnchor="middle">M</text>
                    <circle cx={xPos + 15} cy={classicalY} r="3" fill="#777" />
                    <text x={xPos + 15} y={classicalY + 15} fill="#777" fontSize="10" textAnchor="middle">{cTarget}</text>
                  </g>
                );
              }

              // C. SWAP
              if (op.gate === 'SWAP') {
                const y1 = startY + op.targets[0] * lineGap;
                const y2 = startY + op.targets[1] * lineGap;
                return (
                  <g key={`gate-${index}`}>
                    <line x1={xPos + 15} y1={y1} x2={xPos + 15} y2={y2} stroke="#d4d4d4" strokeWidth="1" />
                    <text x={xPos + 15} y={y1 + 4} fill="#d4d4d4" fontSize="14" fontWeight="bold" textAnchor="middle">×</text>
                    <text x={xPos + 15} y={y2 + 4} fill="#d4d4d4" fontSize="14" fontWeight="bold" textAnchor="middle">×</text>
                  </g>
                );
              }

              // D. GENERAL GATES (Include Controls)
              const target = op.targets[0]; // Main target for drawing box
              const yPos = startY + target * lineGap;

              // Determine connector line range
              let controls = op.controls || [];
              let minY = yPos;
              let maxY = yPos;

              // Draw Controls
              const renderControls = () => {
                if (controls.length === 0) return null;
                return controls.map(c => {
                  const cy = startY + c * lineGap;
                  minY = Math.min(minY, cy);
                  maxY = Math.max(maxY, cy);
                  return <circle key={`ctrl-${c}`} cx={xPos + 15} cy={cy} r="4" fill="#d4d4d4" />;
                });
              };

              const controlElements = renderControls();

              // Draw Vertical Line connecting controls and target
              const renderConnector = () => {
                if (controls.length === 0) return null;
                return <line x1={xPos + 15} y1={minY} x2={xPos + 15} y2={maxY} stroke="#d4d4d4" strokeWidth="1.5" />;
              };

              // Draw Target Box/Symbol
              const renderTarget = () => {
                // For CX/CCX/MCX target is XOR
                if (['CX', 'CCX', 'MCX'].includes(op.gate)) {
                  // Draw target as XOR circle
                  return (
                    <g>
                      <circle cx={xPos + 15} cy={yPos} r="10" fill="#1e1e1e" stroke="#d4d4d4" strokeWidth="1.5" />
                      <line x1={xPos + 5} y1={yPos} x2={xPos + 25} y2={yPos} stroke="#d4d4d4" />
                      <line x1={xPos + 15} y1={yPos - 10} x2={xPos + 15} y2={yPos + 10} stroke="#d4d4d4" />
                    </g>
                  );
                }
                // Standard Box
                else {
                  let label = op.gate.replace('DG', '†').replace('(', '\n(');

                  // Add parameters if present (e.g., rotation angles)
                  if (op.params && op.params.length > 0) {
                    const paramStr = op.params.map(p => {
                      if (typeof p === 'number') return p.toFixed(2);
                      return p;
                    }).join(',');
                    // Use a tooltip or smaller text? 
                    // For now, let's just make the label indicate it
                  }

                  return (
                    <g>
                      <rect x={xPos} y={yPos - 15} width="30" height="30" rx="2" fill={gateColor} stroke="none" />
                      <text x={xPos + 15} y={yPos + 5} fill="white" fontSize="11" fontWeight="bold" textAnchor="middle">{label}</text>
                    </g>
                  );
                }
              };

              return (
                <g key={`gate-${index}`}>
                  {renderConnector()}
                  {controlElements}
                  {renderTarget()}
                </g>
              );

            })}
          </svg>
        </div>
      </div>
    </div>
  );
};

export default CircuitOutput;