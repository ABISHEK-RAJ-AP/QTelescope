import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { Maximize2 } from 'lucide-react';
import { api } from '../services/api';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { ChartPanel, EmptyState, getChartTheme, baseTooltip } from '../components/observability';
import './TopologyExplorer.css';

const STATE_COLOR = { GREEN: '#059669', YELLOW: '#d97706', RED: '#e11d48', UNKNOWN: '#94a3b8' };
const STATE_SYMBOL = { GREEN: 'circle', YELLOW: 'diamond', RED: 'triangle', UNKNOWN: 'rect' };
const LEGACY = { Healthy: 'GREEN', Warning: 'YELLOW', Degraded: 'RED' };
const fmt = (v, d = 2) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(d));

// ponytail: synthetic layout (API has no coordinates). Seeded grid + 120 spring iterations, O(n²·iter); fine to ~300 qubits.
function layoutNodes(nodes, links) {
  const n = nodes.length;
  const cols = Math.ceil(Math.sqrt(n * 1.6));
  const idx = new Map(nodes.map((q, i) => [q.id, i]));
  const pos = nodes.map((_, i) => [(i % cols) * 40, Math.floor(i / cols) * 40]);
  const edges = links.map((l) => [idx.get(String(l.source)), idx.get(String(l.target))]).filter(([a, b]) => a != null && b != null);
  const k = 40;
  for (let it = 0; it < 120; it += 1) {
    const f = pos.map(() => [0, 0]);
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
      const dx = pos[i][0] - pos[j][0] || 0.01; const dy = pos[i][1] - pos[j][1] || 0.01;
      const d2 = dx * dx + dy * dy; if (d2 > k * k * 16) continue;
      const m = (k * k) / d2;
      f[i][0] += dx * m; f[i][1] += dy * m; f[j][0] -= dx * m; f[j][1] -= dy * m;
    }
    edges.forEach(([a, b]) => {
      const dx = pos[a][0] - pos[b][0]; const dy = pos[a][1] - pos[b][1]; const d = Math.hypot(dx, dy) || 1;
      const m = (d - k) / d * 0.5;
      f[a][0] -= dx * m; f[a][1] -= dy * m; f[b][0] += dx * m; f[b][1] += dy * m;
    });
    const cool = 4 * (1 - it / 120) + 0.3;
    pos.forEach((p, i) => { const d = Math.hypot(f[i][0], f[i][1]) || 1; const s = Math.min(d, cool * 3) / d; p[0] += f[i][0] * s; p[1] += f[i][1] * s; });
  }
  return pos;
}

function metricColor(q, mode) {
  if (mode === 'state') return STATE_COLOR[q.state] || STATE_COLOR.UNKNOWN;
  const v = mode === 't1' ? q.t1 : q.readout_error;
  if (v == null) return STATE_COLOR.UNKNOWN;
  if (mode === 't1') return v < 50 ? STATE_COLOR.RED : v < 100 ? STATE_COLOR.YELLOW : STATE_COLOR.GREEN;
  return v > 0.05 ? STATE_COLOR.RED : v > 0.02 ? STATE_COLOR.YELLOW : STATE_COLOR.GREEN;
}

export const TopologyExplorer = () => {
  const [params] = useSearchParams();
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const [backends, setBackends] = useState([]);
  const [backendId, setBackendId] = useState('');
  const [graph, setGraph] = useState(null);
  const [vector, setVector] = useState(null);
  const [colorMode, setColorMode] = useState('state');
  const [selectedId, setSelectedId] = useState(params.get('qubit') ? String(params.get('qubit')) : null);
  const [loadState, setLoadState] = useState('loading');
  const [lastRefresh, setLastRefresh] = useState(null);
  const chartRef = useRef(null);
  const { setActions, clearActions } = usePageActions();

  useEffect(() => {
    api.getBackends().then((b) => {
      setBackends(b || []);
      if (b?.length) setBackendId(b.find((x) => x.backend_id === params.get('backend'))?.backend_id || b[0].backend_id); else setLoadState('empty');
    }).catch(() => setLoadState('error'));
  }, []);

  const load = useCallback(() => {
    if (!backendId) return;
    setLoadState('loading');
    Promise.all([api.getBackendTopology(backendId), api.getHealthVector().catch(() => null)])
      .then(([g, v]) => { setGraph(g); setVector(v); setSelectedId(null); setLastRefresh(new Date()); setLoadState(g?.nodes?.length ? 'ready' : 'empty'); })
      .catch(() => setLoadState('error'));
  }, [backendId]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh topology" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  // merge topology nodes with health-vector per-qubit state
  const qubits = useMemo(() => {
    if (!graph?.nodes) return [];
    const hv = vector?.backends?.find((b) => b.backend_id === backendId)?.qubits || [];
    const byIdx = new Map(hv.map((q) => [q.qubit_index, q]));
    return graph.nodes.map((n) => {
      const h = byIdx.get(n.qubit_index);
      return {
        id: n.id, qubit_index: n.qubit_index, status: n.status,
        t1: h?.t1 ?? n.t1_us, t2: h?.t2 ?? n.t2_us, readout_error: h?.readout_error ?? n.readout_error,
        state: h?.state || LEGACY[n.health_status] || 'UNKNOWN', reasons: h?.reasons || [], action: h?.action,
        F_2q: h?.F_2q, F_1q: h?.F_1q,
      };
    });
  }, [graph, vector, backendId]);

  const positions = useMemo(() => (graph ? layoutNodes(graph.nodes, graph.links || []) : []), [graph]);
  const neighbors = useMemo(() => {
    const m = new Map();
    (graph?.links || []).forEach((l) => {
      const s = String(l.source); const t = String(l.target);
      m.set(s, [...(m.get(s) || []), { id: t, err: l.gate_error }]);
      m.set(t, [...(m.get(t) || []), { id: s, err: l.gate_error }]);
    });
    return m;
  }, [graph]);
  const selected = qubits.find((q) => q.id === selectedId);
  const big = qubits.length > 40;

  const option = useMemo(() => {
    if (!qubits.length) return null;
    const th = getChartTheme(isDark);
    const data = qubits.map((q, i) => ({
      id: q.id, name: `Q${q.qubit_index}`, x: positions[i][0], y: positions[i][1], q,
      symbol: STATE_SYMBOL[q.state] || 'circle',
      symbolSize: q.id === selectedId ? 30 : big ? 20 : 28,
      itemStyle: { color: metricColor(q, colorMode), borderColor: q.id === selectedId ? th.tooltipText : 'transparent', borderWidth: q.id === selectedId ? 3 : 0 },
    }));
    const links = (graph.links || []).map((l) => ({
      source: String(l.source), target: String(l.target), gate_error: l.gate_error,
      lineStyle: { width: l.gate_error != null ? 1 + Math.min(l.gate_error * 120, 4) : 1.5, color: l.gate_error > 0.03 ? STATE_COLOR.RED : th.axisLine, opacity: 0.9 },
    }));
    return {
      animation: false,
      tooltip: {
        ...baseTooltip(isDark),
        trigger: 'item',
        formatter: (p) => {
          if (p.dataType === 'edge') {
            const err = p.data.gate_error;
            const high = err != null && err > 0.03;
            return [
              '<b>Coupling</b>',
              `Q${p.data.source} ↔ Q${p.data.target}`,
              `2Q gate error: ${fmt(err, 4)}${high ? ' · elevated' : ''}`,
              'Click a node to inspect qubits',
            ].join('<br/>');
          }
          const q = p.data.q;
          const nbr = (neighbors.get(q.id) || []).length;
          const lines = [
            `<b>Q${q.qubit_index}</b> · ${q.state}`,
            `T1 ${fmt(q.t1, 1)} µs · T2 ${fmt(q.t2, 1)} µs · readout ${fmt(q.readout_error, 4)}`,
          ];
          if (q.F_1q != null) lines.push(`1Q fidelity ${fmt(q.F_1q, 4)}`);
          if (q.F_2q != null) lines.push(`2Q fidelity ${fmt(q.F_2q, 4)}`);
          if (q.action) lines.push(`Action: ${q.action}`);
          if (q.reasons?.length) lines.push(`Note: ${q.reasons[0]}${q.reasons.length > 1 ? ' (+more)' : ''}`);
          lines.push(`${nbr} coupling${nbr === 1 ? '' : 's'} · click to pin`);
          return lines.join('<br/>');
        },
      },
      series: [{
        type: 'graph', layout: 'none', roam: true, data, links, zoom: 1,
        label: { show: true, position: 'inside', fontSize: big ? 8 : 11, color: '#0b1220', formatter: (p) => p.name.slice(1) },
        emphasis: { focus: 'adjacency', lineStyle: { width: 4 } },
        scaleLimit: { min: 0.4, max: 8 },
      }],
    };
  }, [qubits, positions, graph, colorMode, isDark, selectedId, big, neighbors]);

  const fit = () => chartRef.current?.getEchartsInstance().dispatchAction({ type: 'restore' });
  const onEvents = useMemo(() => ({ click: (p) => { if (p.dataType === 'node') setSelectedId(p.data.id); } }), []);
  const backendName = backends.find((b) => b.backend_id === backendId)?.backend_name;
  const hvTime = vector ? 'live health vector' : 'health vector unavailable — topology fields only';

  return (
    <div className="page-stack">
      <div className="card topo-toolbar">
        <select className="input-control" value={backendId} onChange={(e) => setBackendId(e.target.value)} aria-label="Backend">
          {backends.map((b) => <option key={b.backend_id} value={b.backend_id}>{b.backend_name}</option>)}
        </select>
        <select className="input-control" value={colorMode} onChange={(e) => setColorMode(e.target.value)} aria-label="Color by">
          <option value="state">Color: health state</option>
          <option value="t1">Color: T1</option>
          <option value="readout">Color: readout error</option>
        </select>
        {graph && <span className="topo-meta">{graph.qpu_modality} · {graph.topology_type} · {graph.node_count} qubits · {graph.edge_count} couplings</span>}
      </div>

      <div className="topo-workspace">
        <ChartPanel
          title={`Coupling graph${backendName ? ` — ${backendName}` : ''}`}
          question="Coupling layout with qubit health and readout error encoding."
          sourceKind="derived"
          asOf={lastRefresh?.toLocaleTimeString()}
          provenanceDetail={`Node state as of ${hvTime}. Layout is computed (spring model); physical chip coordinates are not supplied by the backend.`}
          state={loadState === 'ready' ? 'ready' : loadState}
          emptyTitle="No topology"
          emptyMessage="This backend reports no qubits or couplings."
          errorMessage="Could not load topology."
          onRetry={load}
          minHeight={560}
          tableAlternative={(
            <div className="topo-table-wrap">
              <table className="custom-table">
                <thead><tr><th>Qubit</th><th>State</th><th>T1 µs</th><th>T2 µs</th><th>Readout err</th><th>Neighbors</th></tr></thead>
                <tbody>
                  {qubits.map((q) => (
                    <tr key={q.id} className={q.id === selectedId ? 'topo-row-sel' : ''}>
                      <td><button type="button" className="topo-nbr" onClick={() => setSelectedId(q.id)}>Q{q.qubit_index}</button></td>
                      <td>{q.state}</td><td>{fmt(q.t1, 1)}</td><td>{fmt(q.t2, 1)}</td><td>{fmt(q.readout_error, 4)}</td>
                      <td>{(neighbors.get(q.id) || []).map((x) => `Q${x.id}`).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        >
          <div className="topo-canvas">
            <button type="button" className="btn btn-secondary topo-fit" onClick={fit}><Maximize2 size={14} /> Fit to view</button>
            {option && <QtECharts ref={chartRef} option={option} onEvents={onEvents} notMerge style={{ height: '100%', width: '100%' }} />}
          </div>
          <div className="topo-legend">
            {colorMode === 'state' ? (
              <>
                <span><i style={{ background: STATE_COLOR.GREEN }} />Green ●</span>
                <span><i className="sq" style={{ background: STATE_COLOR.YELLOW, transform: 'rotate(45deg)' }} />Yellow ◆</span>
                <span><i className="sq" style={{ background: STATE_COLOR.RED }} />Red ▲</span>
                <span><i className="sq" style={{ background: STATE_COLOR.UNKNOWN }} />Unknown ■</span>
              </>
            ) : (
              <span>{colorMode === 't1' ? 'T1: green ≥100 µs, amber 50–100, red <50' : 'Readout: green ≤2%, amber 2–5%, red >5%'} · marker shape still shows health state</span>
            )}
            <span>Edge width ∝ gate error; red &gt;3%</span>
            <span>Scroll to zoom · drag to pan · layout synthetic</span>
          </div>
        </ChartPanel>

        <aside className="card topo-side" aria-label="Selected qubit">
          {selected ? (
            <>
              <h3>Qubit {selected.qubit_index}</h3>
              <div><span className="page-hint">State: </span><b>{selected.state}</b>{selected.action ? ` · ${selected.action}` : ''} · {selected.status}</div>
              <div className="topo-metrics">
                <div className="topo-metric"><span>T1 (µs)</span><b>{fmt(selected.t1, 1)}</b></div>
                <div className="topo-metric"><span>T2 (µs)</span><b>{fmt(selected.t2, 1)}</b></div>
                <div className="topo-metric"><span>Readout err</span><b>{fmt(selected.readout_error, 4)}</b></div>
                <div className="topo-metric"><span>2q fidelity</span><b>{fmt(selected.F_2q, 4)}</b></div>
              </div>
              {selected.reasons.length > 0 && <><h4>Reasons</h4><ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>{selected.reasons.map((r) => <li key={r}>{r}</li>)}</ul></>}
              <h4>Neighbors ({(neighbors.get(selected.id) || []).length})</h4>
              <div className="topo-nbrs">
                {(neighbors.get(selected.id) || []).map((x) => (
                  <button key={x.id} type="button" className="topo-nbr" onClick={() => setSelectedId(x.id)} title={`gate error ${fmt(x.err, 4)}`}>Q{x.id} · {fmt(x.err, 4)}</button>
                ))}
              </div>
              <div className="topo-actions">
                <Link className="btn btn-secondary" to="/app/resources/health">Health vector</Link>
                <Link className="btn btn-secondary" to={`/app/telemetry/drift?backend=${encodeURIComponent(backendId)}`}>Drift analysis</Link>
              </div>
            </>
          ) : (
            <EmptyState variant="inline" compact align="start" title="No qubit selected" message="Select a node or table row to view metrics and neighbors." />
          )}
        </aside>
      </div>
    </div>
  );
};
