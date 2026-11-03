import React, { useState } from 'react';
import './ResultWindow.css';
import CircuitOutput from './CircuitOutput';
import InteractiveQSphere from './InteractiveQSphere';

const ResultWindow = ({ metrics, onClose }) => {
    const [showInteractiveQsphere, setShowInteractiveQsphere] = useState(false);
    
    if (!metrics) return null;

    return (
        <div className="result-window-overlay">
            <div className="result-window">
                <div className="result-header">
                    <h2>Quantum Execution Results</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="result-content">
                    {/* Key Metrics */}
                    <div className="metrics-grid">
                        <div className="metric-card">
                            <h3>Execution Time</h3>
                            <p>{metrics.execution_time ? `${metrics.execution_time}s` : 'N/A'}</p>
                        </div>
                        <div className="metric-card">
                            <h3>Qubits</h3>
                            <p>{metrics.circuit_data?.num_qubits || 0}</p>
                        </div>
                        <div className="metric-card">
                            <h3>Circuit Depth</h3>
                            <p>{metrics.circuit_data?.depth || 0}</p>
                        </div>
                        <div className="metric-card">
                            <h3>Backend</h3>
                            <p>{metrics.backend || 'Simulator'}</p>
                        </div>
                        <div className="metric-card">
                            <h3>Gate Count</h3>
                            <p>{metrics.circuit_data?.gates ? Object.values(metrics.circuit_data.gates).reduce((a, b) => a + b, 0) : 0}</p>
                        </div>
                        <div className="metric-card">
                            <h3>Shots</h3>
                            <p>{metrics.shots || 1024}</p>
                        </div>
                    </div>

                    {/* Evaluation Metrics Section */}
                    <div className="evaluation-metrics">
                        <h3>Evaluation Metrics</h3>
                        <table className="metrics-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>
                                    <th style={{ padding: '8px' }}>Metric</th>
                                    <th style={{ padding: '8px' }}>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ background: '#222' }}>
                                    <td style={{ padding: '8px' }}>Fidelity</td>
                                    <td style={{ padding: '8px' }}>{metrics.fidelity || 'N/A'}</td>
                                </tr>
                                <tr style={{ background: '#1e1e1e' }}>
                                    <td style={{ padding: '8px' }}>Estimated Cost</td>
                                    <td style={{ padding: '8px' }}>Free Tier</td>
                                </tr>
                                {metrics.circuit_data?.gates && Object.entries(metrics.circuit_data.gates).map(([gate, count], i) => (
                                    <tr key={gate} style={{ background: i % 2 === 0 ? '#222' : '#1e1e1e' }}>
                                        <td style={{ padding: '8px' }}>{gate.toUpperCase()} Gate</td>
                                        <td style={{ padding: '8px' }}>{count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Visualizations Graphs - Bloch Sphere */}
                    <div className="visualizations-section">
                        <div className="viz-box">
                            <h3>Bloch Sphere (Per Qubit)</h3>
                            {metrics.bloch_sphere ? (
                                <img
                                    src={`data:image/png;base64,${metrics.bloch_sphere}`}
                                    alt="Bloch Sphere"
                                    className="bloch-image"
                                />
                            ) : (
                                <div className="placeholder">
                                    {metrics.error ? 'Error generating Bloch Sphere' : 'No Bloch Sphere data available'}
                                </div>
                            )}

                            {/* Display Statevector Amplitudes */}
                            {metrics.statevector_data && (
                                <div className="statevector-list" style={{ marginTop: '10px', width: '100%', fontSize: '11px', maxHeight: '100px', overflowY: 'auto', background: '#222', padding: '5px', borderRadius: '4px' }}>
                                    <strong>Statevector:</strong>
                                    {Object.entries(metrics.statevector_data).map(([state, amp]) => (
                                        <div key={state} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', padding: '2px 0' }}>
                                            <span style={{ color: '#9cdcfe' }}>|{state}⟩</span>
                                            <span style={{ color: '#ce9178', fontFamily: 'monospace' }}>{amp}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Q-Sphere Box - ADDED */}
                        {metrics.qsphere_image && (
                            <div className="viz-box">
                                <h3>Q-Sphere (Entanglement)</h3>
                                <img
                                    src={`data:image/png;base64,${metrics.qsphere_image}`}
                                    alt="Q-Sphere"
                                    className="bloch-image interactive-trigger"
                                    style={{ cursor: 'pointer', transition: 'transform 0.2s', filter: 'drop-shadow(0 0 10px rgba(0, 188, 206, 0.4))' }}
                                    title="Click to launch interactive 3D spherical environment"
                                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    onClick={() => {
                                        if (metrics.statevector_data) setShowInteractiveQsphere(true);
                                        else alert("Interactive mode requires accurate Statevector calculations natively populated.");
                                    }}
                                />
                                <div style={{ textAlign: 'center', fontSize: '10px', color: '#0ebcce', marginTop: '5px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>▶ Click Sphere to rotate 3D mesh</div>
                            </div>
                        )}

                        <div className="viz-box">
                            <h3>Measurement Histogram (Probabilities)</h3>
                            {metrics.counts ? (
                                <div className="counts-chart" style={{ display: 'flex', alignItems: 'flex-end', height: '200px', gap: '8px', padding: '10px 0', overflowX: 'auto' }}>
                                    {Object.entries(metrics.counts).map(([state, count]) => {
                                        const probability = (count / (metrics.shots || 1024));
                                        const percentage = (probability * 100).toFixed(1);
                                        return (
                                            <div key={state} className="chart-bar-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', flex: 1, minWidth: '40px' }}>
                                                <div
                                                    className="bar-fill-vertical"
                                                    style={{
                                                        height: `${percentage}%`,
                                                        width: '100%',
                                                        background: 'linear-gradient(to top, #0e639c, #2da44e)',
                                                        borderRadius: '4px 4px 0 0',
                                                        position: 'relative',
                                                        transition: 'height 0.5s ease-out'
                                                    }}
                                                    title={`${count} shots (${percentage}%)`}
                                                >
                                                    <span style={{
                                                        position: 'absolute',
                                                        top: '-20px',
                                                        width: '100%',
                                                        textAlign: 'center',
                                                        fontSize: '10px',
                                                        color: '#ccc'
                                                    }}>
                                                        {percentage}%
                                                    </span>
                                                </div>
                                                <span className="state-label" style={{ marginTop: '5px', fontSize: '12px', fontFamily: 'monospace' }}>|{state}⟩</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <p>No counts available</p>}
                        </div>
                    </div>

                    {/* Extended Circuit Diagram Section */}
                    {/* Extended Circuit Diagram Section */}
                    {metrics.circuit_data && (
                        <div className="circuit-diagram-section" style={{ marginTop: '20px', background: '#27272a', padding: '0', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', overflow: 'hidden' }}>
                            <CircuitOutput circuitData={metrics.circuit_data} />
                        </div>
                    )}
                </div>

                {/* Circuit info */}
                {/* <CircuitOutput circuitData={metrics.circuit_data} /> */}
            </div>

            {/* Interactive Viewer Overlay */}
            {showInteractiveQsphere && metrics.statevector_data && (
                <InteractiveQSphere 
                    statevectorData={metrics.statevector_data} 
                    onClose={() => setShowInteractiveQsphere(false)} 
                />
            )}
        </div>
    );
};

export default ResultWindow;
