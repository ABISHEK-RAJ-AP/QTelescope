import React, { useState } from 'react';
import './BenchmarkPanel.css';
import CircuitOutput from './CircuitOutput';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import InteractiveQSphere from './InteractiveQSphere';

const BenchmarkPanel = ({ results, summary, staticData, onClose }) => {
    // staticData: { circuit_diagram, bloch_sphere, circuit_data }

    // Tab state for detailed comparison
    const [selectedBackend, setSelectedBackend] = useState(null);
    const [showInteractiveQsphere, setShowInteractiveQsphere] = useState(false);

    const handleDownload = async () => {
        const element = document.getElementById('benchmark-pdf-content');
        if (!element) return;
        
        // Add a temporary class to prepare strictly for printing format
        element.classList.add('pdf-rendering');
        
        try {
            const canvas = await html2canvas(element, { 
                scale: 2, 
                backgroundColor: '#ffffff', 
                useCORS: true,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight,
                width: element.scrollWidth,
                height: element.scrollHeight
            });
            const imgData = canvas.toDataURL('image/png');
            
            // Calculate a single custom page size that precisely matches the dashboard proportion
            let pdf = new jsPDF('p', 'pt', [canvas.width, canvas.height]);
            // If the grid is wider than tall, set landscape natively
            if (canvas.width > canvas.height) {
                pdf = new jsPDF('l', 'pt', [canvas.width, canvas.height]);
            }
            
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`quantum_benchmark_report_${new Date().getTime()}.pdf`);
        } catch (error) {
            console.error("PDF generation failed:", error);
        } finally {
            element.classList.remove('pdf-rendering');
        }
    };

    return (
        <div className="result-window-overlay">
            <div className="result-window benchmark-window-full">
                <div className="result-header">
                    <h2>Quantum Benchmark Dashboard</h2>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        {summary && (
                            <button className="btn-small" onClick={handleDownload} style={{ margin: 0, padding: '6px 12px', background: '#2da44e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8 12L3 7L4.4 5.55L7 8.15V0H9V8.15L11.6 5.55L13 7L8 12ZM2 16C1.45 16 1.02083 15.8042 0.6625 15.4125C0.304167 15.0208 0.125 14.55 0.125 14V11H2.125V14H13.875V11H15.875V14C15.875 14.55 15.6958 15.0208 15.3375 15.4125C14.9792 15.8042 14.55 16 14 16H2Z" fill="currentColor"/>
                                </svg>
                                Download Report
                            </button>
                        )}
                        <button className="close-btn" onClick={onClose}>×</button>
                    </div>
                </div>

                <div className="benchmark-dashboard" id="benchmark-pdf-content" style={{ padding: '20px', borderRadius: '10px' }}>
                    {/* LEFT PANEL: Overview & Diagram */}
                    <div className="benchmark-left">
                        {/* 1. Circuit & Bloch */}
                        <div className="viz-box">
                            <h3>Circuit Architecture</h3>
                            {staticData?.circuit_diagram ? (
                                <pre className="circuit-ascii">{staticData.circuit_diagram}</pre>
                            ) : <p>Loading Circuit...</p>}
                            <div className="mini-metrics">
                                <span><strong>Qubits:</strong> {staticData?.circuit_data?.num_qubits || '-'}</span>
                                <span><strong>Depth:</strong> {staticData?.circuit_data?.depth || '-'}</span>
                            </div>

                            {/* Gate Breakdown Table */}
                            {staticData?.circuit_data?.gates && (
                                <div className="gate-metrics-container">
                                    <h4>Gate Distribution</h4>
                                    <table className="gate-metrics-table">
                                        <thead>
                                            <tr>
                                                <th>TYPE</th>
                                                <th style={{ textAlign: 'right' }}>COUNT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(staticData.circuit_data.gates).map(([gate, count]) => (
                                                <tr key={gate}>
                                                    <td><span className="gate-token">{gate.toUpperCase()}</span></td>
                                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{count}</td>
                                                </tr>
                                            ))}
                                            <tr className="gate-total-row">
                                                <td><strong>TOTAL</strong></td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <strong>{Object.values(staticData.circuit_data.gates).reduce((a, b) => a + b, 0)}</strong>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* 2. Bloch Sphere (Expected) */}
                        <div className="viz-box">
                            <h3>Ideal State (Bloch Sphere)</h3>
                            {staticData?.bloch_sphere ? (
                                <img src={`data:image/png;base64,${staticData.bloch_sphere}`} className="bloch-image-small" />
                            ) : <p>Generating...</p>}
                        </div>

                        {/* 3. Q-Sphere (Entanglement) */}
                        <div className="viz-box">
                            <h3>Ideal State (Q-Sphere)</h3>
                            {staticData?.qsphere_image ? (
                                <>
                                <img 
                                    src={`data:image/png;base64,${staticData.qsphere_image}`} 
                                    className="bloch-image-small interactive-trigger" 
                                    style={{ cursor: 'pointer', transition: 'transform 0.2s', filter: 'drop-shadow(0 0 10px rgba(0, 188, 206, 0.4))' }}
                                    title="Click to launch interactive 3D spherical environment"
                                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    onClick={() => {
                                        if (staticData.statevector_data) setShowInteractiveQsphere(true);
                                        else alert("Interactive mode requires accurate Statevector calculations natively populated.");
                                    }}
                                />
                                <div style={{ textAlign: 'center', fontSize: '10px', color: '#0ebcce', marginTop: '5px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>▶ Click Sphere to rotate 3D mesh</div>
                                </>
                            ) : <p>Generating...</p>}
                        </div>
                    </div>

                    {/* RIGHT PANEL: Results & Comparison */}
                    <div className="benchmark-right">

                        {/* RUNNING ANIMATION BANNER */}
                        {!summary && (
                            <div className="benchmark-running-banner">
                                <span className="spinner-quantum"></span>
                                <span>Running Quantum Benchmark...</span>
                            </div>
                        )}

                        {/* 1. Comparison Table */}
                        <div className="table-container">
                            {!summary && <div className="scanning-line"></div>}
                            <h3>Performance Matrix</h3>
                            <table className="metrics-table benchmark-table">
                                <thead>
                                    <tr>
                                        <th>Backend</th>
                                        <th>Time</th>
                                        <th>Fidelity</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((res, i) => (
                                        <React.Fragment key={i}>
                                            <tr className={selectedBackend?.backend === res.backend ? 'selected-row' : ''}>
                                                <td>
                                                    <div className="backend-name-cell">
                                                        {res.backend}
                                                        <span className={`badge ${res.type}`}>{res.type}</span>
                                                    </div>
                                                    {summary && (
                                                        <div className="awards">
                                                            {res.backend === summary.best_fidelity && <span className="award fidelity">🏆 High Fidelity</span>}
                                                            {res.backend === summary.fastest && <span className="award speed">⚡ Fastest</span>}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>{res.execution_time}s</td>
                                                <td>
                                                    <div className="bar-container-small">
                                                        <div className="bar-fill" style={{ width: `${res.fidelity * 100}%`, background: res.fidelity > 0.9 ? '#2da44e' : '#d7ba7d' }}></div>
                                                    </div>
                                                    <span style={{ fontSize: '12px' }}>{(res.fidelity * 100).toFixed(1)}%</span>
                                                </td>
                                                <td>
                                                    <button className="btn-small" onClick={() => setSelectedBackend(selectedBackend?.backend === res.backend ? null : res)}>
                                                        {selectedBackend?.backend === res.backend ? 'Close' : 'Analysis'}
                                                    </button>
                                                </td>
                                            </tr>
                                            {selectedBackend?.backend === res.backend && (
                                                <tr className="detail-row">
                                                    <td colSpan="4" style={{ padding: 0 }}>
                                                        <div className="backend-detail-view" style={{ borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 0 }}>
                                                            <div className="detail-header">
                                                                <h4>Analysis: {selectedBackend.backend}</h4>
                                                                <button onClick={() => setSelectedBackend(null)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer' }}>×</button>
                                                            </div>
                                                            <div className="detail-grid">
                                                                <div className="detail-metric">
                                                                    <label>Shots</label>
                                                                    <span>{selectedBackend.shots}</span>
                                                                </div>
                                                                <div className="detail-metric">
                                                                    <label>Error Rate</label>
                                                                    <span style={{ color: '#f44747' }}>{(selectedBackend.error_rate * 100).toFixed(2)}%</span>
                                                                </div>
                                                            </div>

                                                            {/* Histogram */}
                                                            <div className="histogram-box">
                                                                <h5>Distribution (Histogram)</h5>
                                                                {selectedBackend.counts ? (
                                                                    <div className="counts-chart-small">
                                                                        {Object.entries(selectedBackend.counts).sort().map(([state, count]) => {
                                                                            const probability = (count / selectedBackend.shots);
                                                                            // Scale height to fit comfortably (max usually around 50-100% depending on distribution)
                                                                            // Simple scaling: normalized to max count would be better, but let's stick to probability for now.
                                                                            // Actually, let's normalize to the highest count to fill the height.
                                                                            const maxCount = Math.max(...Object.values(selectedBackend.counts));
                                                                            const heightPct = (count / maxCount) * 100;

                                                                            return (
                                                                                <div key={state} className="hist-bar-group" title={`${state}: ${count} (${(probability * 100).toFixed(1)}%)`}>
                                                                                    <span className="hist-value">{count}</span>
                                                                                    <div className="hist-bar" style={{ height: `${heightPct * 0.8}%` }}></div>
                                                                                    <span className="hist-label">|{state}⟩</span>
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                ) : <p>No counts data available.</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                    </div>
                </div>
            </div>

            {/* Interactive Viewer Overlay */}
            {showInteractiveQsphere && staticData?.statevector_data && (
                <InteractiveQSphere 
                    statevectorData={staticData.statevector_data} 
                    onClose={() => setShowInteractiveQsphere(false)} 
                />
            )}
        </div>
    );
};

export default BenchmarkPanel;
