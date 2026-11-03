import React, { useState } from 'react';
import CodeEditor from './CodeEditor';
import CircuitOutput from './CircuitOutput';

const Notebook = ({ cells, onRunCell, onUpdateCell, onAddCell, onDeleteCell, onUpdateCellLanguage, onUpdateCellBackend }) => {
    return (
        <div className="notebook-container">
            <div className="notebook-toolbar">
                <button className="btn-small" onClick={() => onAddCell('code')}>+ Code</button>
                <button className="btn-small" onClick={() => onAddCell('markdown')}>+ Text</button>
            </div>

            <div className="cells-list">
                {cells.map((cell, index) => (
                    <div key={cell.id} className="notebook-cell">

                        {/* Cell Controls */}
                        <div className="cell-controls">
                            <span className="cell-index">[{index + 1}]</span>
                            <div className="cell-actions">
                                {cell.type === 'code' && (
                                    <>
                                        {/* Static Language Label */}
                                        <span style={{
                                            marginRight: '5px',
                                            background: '#333',
                                            color: '#aaa',
                                            border: '1px solid #555',
                                            padding: '2px 6px',
                                            fontSize: '11px',
                                            borderRadius: '3px',
                                            textTransform: 'uppercase',
                                            fontWeight: 'bold'
                                        }}>
                                            {cell.language === 'openqasm' ? 'OpenQASM' : 'Python'}
                                        </span>

                                        {/* Backend Selector for OpenQASM */}
                                        {cell.language === 'openqasm' && (
                                            <select
                                                className="cell-backend-select"
                                                value={cell.backend || 'qasm_simulator'}
                                                onChange={(e) => onUpdateCellBackend(cell.id, e.target.value)}
                                                style={{ marginRight: '5px', background: '#252526', color: '#4daafc', border: '1px solid #4daafc', padding: '2px', fontSize: '11px' }}
                                            >
                                                <option value="qasm_simulator">QASM Simulator</option>
                                                <option value="aer_simulator_statevector">Aer Statevector</option>
                                                <option value="aer_simulator_density_matrix">Aer Density Matrix</option>
                                                <option value="aer_simulator_statevector_gpu">Aer Statevector GPU</option>
                                                <option value="nvidia_cudaq_statevector_simulator">NVIDIA cuQuantum</option>
                                                <option value="cirq_simulator">Cirq Simulator</option>
                                                <option value="qsimcirq_simulator">QSimCirq Simulator</option>
                                                <option value="qsimcirq_cuquantum_gpu_simulator">QSimCirq cuQuantum GPU</option>
                                                <option value="qulacs_multicpu_simulator">Qulacs Multi-CPU</option>
                                                <option value="fpga_simulator">FPGA Simulator</option>
                                                <option value="quest_simulator">QuEST Simulator</option>
                                            </select>
                                        )}
                                    </>
                                )}
                                <button onClick={() => onDeleteCell(cell.id)} className="icon-btn" title="Delete Cell">🗑️</button>
                                <button onClick={() => onAddCell('code', index + 1)} className="icon-btn" title="Add below">+C</button>
                            </div>
                        </div>

                        {/* Cell Content */}
                        <div className="cell-body">
                            {cell.type === 'markdown' ? (
                                <textarea
                                    className="markdown-editor"
                                    value={cell.content}
                                    onChange={(e) => onUpdateCell(cell.id, e.target.value)}
                                    placeholder="Type markdown here..."
                                />
                            ) : (
                                <div className="code-cell-wrapper">
                                    <CodeEditor
                                        code={cell.content}
                                        onChange={(val) => onUpdateCell(cell.id, val)}
                                        height="160px"
                                        minHeight="100px"
                                    />
                                    <button
                                        className={`run-cell-btn ${cell.status === 'running' ? 'running' : ''}`}
                                        onClick={() => onRunCell(cell.id)}
                                        disabled={cell.status === 'running'}
                                    >
                                        {cell.status === 'running' ? '⏳' : '▶'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Cell Output */}
                        {cell.type === 'code' && (cell.logs.some(l => !l.msg.match(/^[🚀⚡⚠️]/)) || cell.result) && (
                            <div className="cell-output" style={{ padding: '5px 10px' }}>
                                {/* Console Logs (Filtered) */}
                                {cell.logs.length > 0 && (
                                    <div className="output-logs" style={{ border: 'none', marginBottom: '5px' }}>
                                        {cell.logs
                                            .filter(log => !log.msg.match(/^[🚀⚡⚠️]/)) // Filter system messages
                                            .map((log, i) => (
                                                <div key={i} className={`log-line`} style={{ color: '#d4d4d4', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                                    {log.msg}
                                                </div>
                                            ))}
                                    </div>
                                )}

                                {/* Execution Result */}
                                {cell.result && (
                                    <div className="output-result">
                                        {/* Circuit Visualization (ASCII Priority) */}
                                        {cell.result.circuit_diagram ? (
                                            <pre style={{
                                                fontSize: '13px',
                                                lineHeight: '1.2',
                                                color: '#9cdcfe',
                                                background: '#111',
                                                padding: '10px',
                                                borderRadius: '4px',
                                                overflowX: 'auto',
                                                fontFamily: "'Consolas', 'Courier New', monospace",
                                                border: '1px solid #333'
                                            }}>
                                                {cell.result.circuit_diagram}
                                            </pre>
                                        ) : (cell.result.circuit_data ? (
                                            <div className="mini-circuit-info" style={{ margin: '10px 0' }}>
                                                <CircuitOutput circuitData={cell.result.circuit_data} />


                                            </div>
                                        ) : null)}

                                        {/* Result Counts (Python Dict Style) */}
                                        {cell.result.counts && (
                                            <div style={{
                                                marginTop: '5px',
                                                color: '#d4d4d4',
                                                fontFamily: 'monospace',
                                                fontSize: '13px'
                                            }}>
                                                {JSON.stringify(cell.result.counts).split('"').join("'").replace(/,/g, ', ')}
                                            </div>
                                        )}

                                        {/* Result Image (Bloch Sphere) */}
                                        {cell.result.bloch_sphere && (
                                            <div style={{ marginTop: '10px' }}>
                                                <div style={{ fontSize: '11px', color: '#aaa' }}>Bloch Sphere (Local States):</div>
                                                <img
                                                    src={`data:image/png;base64,${cell.result.bloch_sphere}`}
                                                    alt="Bloch Sphere"
                                                    style={{ maxHeight: '250px', borderRadius: '4px' }}
                                                />
                                            </div>
                                        )}

                                        {/* Result Image (Q-Sphere) */}
                                        {cell.result.qsphere_image && (
                                            <div style={{ marginTop: '10px' }}>
                                                <div style={{ fontSize: '11px', color: '#aaa' }}>Q-Sphere (Entanglement Visualization):</div>
                                                <img
                                                    src={`data:image/png;base64,${cell.result.qsphere_image}`}
                                                    alt="Q-Sphere"
                                                    style={{ maxHeight: '250px', borderRadius: '4px' }}
                                                />
                                            </div>
                                        )}

                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {cells.length === 0 && (
                    <div className="empty-notebook">
                        <p>Notebook is empty. Add a Code or Text cell to start.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notebook;
