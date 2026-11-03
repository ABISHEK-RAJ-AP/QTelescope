import React from 'react';

const MetricsPanel = ({ status, metrics }) => {
  if (!metrics) {
    return (
      <div className="results">
        <div className="header">EXECUTION METRICS</div>
        <div className="metrics-content">
          <div style={{ color: '#666', fontStyle: 'italic', padding: '10px' }}>
            Run a circuit to see metrics...
          </div>
        </div>
      </div>
    );
  }

  // Calculate most frequent outcome
  const counts = metrics.counts || {};
  const entries = Object.entries(counts);
  let topResult = "N/A";

  if (entries.length > 0) {
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    topResult = `${sorted[0][0]} (${sorted[0][1]})`;
  }

  return (
    <div className="results">
      <div className="header">EXECUTION METRICS</div>
      <div className="metrics-content" style={{ display: 'flex', gap: '20px' }}>

        {/* Left Column: Metrics */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div className="metric-row">
            <span className="metric-label">Status:</span>
            <span className={`metric-value ${status === 'Error' ? 'log-error' : 'log-success'}`}>
              {status}
            </span>
          </div>

          <div className="metric-row">
            <span className="metric-label">Backend:</span>
            <span className="metric-value" style={{ color: '#4daafc' }}>
              {metrics.backend || metrics.backend_used || 'Unknown'}
            </span>
          </div>

          <div className="metric-row">
            <span className="metric-label">Time:</span>
            <span className="metric-value">
              {metrics.execution_time}s
            </span>
          </div>

          <div className="metric-row">
            <span className="metric-label">Qubits:</span>
            <span className="metric-value">{metrics.circuit_data?.num_qubits || 0}</span>
          </div>

          <div className="metric-row">
            <span className="metric-label">Depth:</span>
            <span className="metric-value">{metrics.circuit_data?.depth || 0}</span>
          </div>

          <div className="metric-row">
            <span className="metric-label">Top Result:</span>
            <span className="metric-value" style={{ color: '#89d185' }}>{topResult}</span>
          </div>
        </div>

        {/* Right Column: Counts */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="header" style={{ marginBottom: '5px' }}>COUNTS DISTRIBUTION</div>
          <div className="counts-preview" style={{ flex: 1, maxHeight: 'none' }}>
            <pre>{JSON.stringify(counts, null, 2)}</pre>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MetricsPanel;