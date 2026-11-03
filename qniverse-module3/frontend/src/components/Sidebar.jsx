import React, { useState, useEffect } from "react";


const GATES = [
  { symbol: 'H', name: 'Hadamard', diagram: '[ H ]' },
  { symbol: 'X', name: 'Pauli-X', diagram: '[ X ]' },
  { symbol: 'Y', name: 'Pauli-Y', diagram: '[ Y ]' },
  { symbol: 'Z', name: 'Pauli-Z', diagram: '[ Z ]' },
  { symbol: 'CX', name: 'CNOT', diagram: '●─⊕' },
  { symbol: 'M', name: 'Measure', diagram: '[ M ]' },
  { symbol: 'S', name: 'Phase Gate', diagram: '[ S ]' },
  { symbol: 'T', name: 'T Gate', diagram: '[ T ]' },
  { symbol: 'RX', name: 'Rotation X', diagram: 'R(x)' },
  { symbol: 'RY', name: 'Rotation Y', diagram: 'R(y)' },
  { symbol: 'RZ', name: 'Rotation Z', diagram: 'R(z)' },
];

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 250;

const Sidebar = ({
  files,
  activeFileName,
  onSelectFile,
  onCreateFile,
  onRenameFile, // Receive the prop
  onUploadFile,
  onDeleteFile,
  onRun,
  onLoadTemplate,
  viewMode,
  onSetViewMode
}) => {
  const [width, setWidth] = useState(
    () => Number(localStorage.getItem("sidebarWidth")) || DEFAULT_WIDTH
  );

  useEffect(() => {
    localStorage.setItem("sidebarWidth", width);
  }, [width]);

  const startResize = () => {
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const resize = (e) => setWidth(Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH));
    const stopResize = () => {
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
      document.removeEventListener("mousemove", resize);
      document.removeEventListener("mouseup", stopResize);
    };
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stopResize);
  };

  const [showBenchmarkConfirm, setShowBenchmarkConfirm] = useState(false);

  return (
    <>
      <div className="sidebar" style={{ width: `${width}px` }}>
        <h3 className="app-title">IDE</h3>

        {/* VIEW TOGGLE */}
        <div className="view-toggle" style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
          <button
            className={`btn-small ${viewMode === 'editor' ? 'active-view' : ''}`}
            onClick={() => onSetViewMode('editor')}
            style={{ textAlign: 'center', background: viewMode === 'editor' ? '#0e639c' : '', color: viewMode === 'editor' ? 'white' : '' }}
          >
            Editor
          </button>
          <button
            className={`btn-small ${viewMode === 'notebook' ? 'active-view' : ''}`}
            onClick={() => onSetViewMode('notebook')}
            style={{ textAlign: 'center', background: viewMode === 'notebook' ? '#0e639c' : '', color: viewMode === 'notebook' ? 'white' : '' }}
          >
            Notebook
          </button>
        </div>

        {viewMode === 'editor' && (
          <>
            <button className="btn btn-run" onClick={onRun} title="Run Active File">
              ▶ Run
            </button>
            <button
              className="btn btn-run btn-benchmark"
              onClick={() => setShowBenchmarkConfirm(true)}
              title="Run Multi-Backend Benchmark"
              style={{ marginTop: '5px', background: '#d7ba7d', color: '#000' }}
            >
              ⚡ Benchmark
            </button>
          </>
        )}

        <div className="divider" />

        <div className="section-header">
          <span>PROJECT FILES</span>
          <div className="file-actions">
            <button className="icon-btn" onClick={onCreateFile} title="New File">+</button>


            <label className="icon-btn" title="Upload File">
              ↑
              <input type="file" style={{ display: 'none' }} onChange={onUploadFile} accept=".py,.qasm" />
            </label>
          </div>
        </div>

        <div className="file-list">
          {files.map(file => (
            <div
              key={file.name}
              className={`file-item ${file.name === activeFileName ? 'active' : ''}`}
              onClick={() => onSelectFile(file.name)}
            >
              <span className="file-name">{file.name.split('.')[0]}</span>

              <div className="item-actions">
                <span
                  className="action-icon rename-icon"
                  onClick={(e) => onRenameFile(e, file.name)}
                  title="Rename File"
                >
                  ✎
                </span>
                <span
                  className="action-icon delete-icon"
                  onClick={(e) => onDeleteFile(e, file.name)}
                  title="Delete File"
                >
                  ×
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="divider" />


        <div className="header">AVAILABLE BACKENDS</div>
        <div className="backend-list" style={{ padding: '0 10px', fontSize: '11px', color: '#888' }}>
          <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
            <li>qasm_simulator</li>
            <li>aer_simulator_statevector</li>
            <li>aer_simulator_density_matrix</li>
            <li>aer_simulator_statevector_gpu</li>
            <li>nvidia_cudaq_statevector_simulator</li>
            <li>cirq_simulator</li>
            <li>qsimcirq_simulator</li>
            <li>qsimcirq_cuquantum_gpu_simulator</li>
            <li>qulacs_multicpu_simulator</li>
            <li>fpga_simulator</li>
            <li>quest_simulator</li>
          </ul>
        </div>

        <div className="divider" />

        <div className="header">GATE REFERENCE</div>
        <div className="gate-list" style={{ padding: '0 10px', fontSize: '11px', color: '#ccc', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #444', color: '#888', textAlign: 'left' }}>
                <th style={{ padding: '4px 0', fontWeight: 'normal' }}>Gate</th>
                <th style={{ padding: '4px 0', fontWeight: 'normal' }}>Name</th>
                <th style={{ padding: '4px 0', fontWeight: 'normal', textAlign: 'right' }}>Rep</th>
              </tr>
            </thead>
            <tbody>
              {GATES.map(gate => (
                <tr key={gate.symbol} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '6px 0', color: '#4daafc', fontWeight: 'bold' }}>{gate.symbol}</td>
                  <td style={{ padding: '6px 0', color: '#eee' }}>{gate.name}</td>
                  <td style={{ padding: '6px 0', fontFamily: 'monospace', color: '#ffcc00', textAlign: 'right' }}>{gate.diagram}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sidebar-resizer" onMouseDown={startResize} onDoubleClick={() => setWidth(DEFAULT_WIDTH)} />

      {/* BENCHMARK CONFIRMATION MODAL */}
      {showBenchmarkConfirm && (
        <div className="modal-overlay">
          <div className="modal-window">
            <div className="modal-header">
              <h3>⚡ Start Quantum Benchmarking?</h3>
            </div>
            <div className="modal-content">
              <p>This process utilizes significant resources to generate detailed analytics:</p>
              <ul style={{ textAlign: 'left', margin: '10px 0 20px 0', paddingLeft: '20px', color: '#ccc' }}>
                <li><strong>Compiles</strong> your circuit for multiple backends.</li>
                <li><strong>Executes</strong> parallel simulations for comparison.</li>
                <li><strong>Generates</strong> fidelity metrics and timing analysis.</li>
              </ul>
              <p className="warning-text">⚠️ Expect a brief delay while simulations run.</p>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowBenchmarkConfirm(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => {
                setShowBenchmarkConfirm(false);
                onRun('BENCHMARK');
              }}>Confirm & Run</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;