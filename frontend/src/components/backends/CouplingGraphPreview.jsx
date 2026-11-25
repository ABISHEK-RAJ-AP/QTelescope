import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { QtECharts } from '../observability/QtECharts.jsx';
import { getChartInkColor, getFleetStateChartColors } from '../observability/chartTheme.js';

/** ponytail: spring layout (TopologyExplorer pattern), capped for workspace embed. */
function layoutNodes(count, edges) {
  const cols = Math.ceil(Math.sqrt(count * 1.6)) || 1;
  const pos = Array.from({ length: count }, (_, i) => [(i % cols) * 40, Math.floor(i / cols) * 40]);
  const k = 40;
  for (let it = 0; it < 80; it += 1) {
    const f = pos.map(() => [0, 0]);
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        const dx = pos[i][0] - pos[j][0] || 0.01;
        const dy = pos[i][1] - pos[j][1] || 0.01;
        const d2 = dx * dx + dy * dy;
        if (d2 > k * k * 16) continue;
        const m = (k * k) / d2;
        f[i][0] += dx * m;
        f[i][1] += dy * m;
        f[j][0] -= dx * m;
        f[j][1] -= dy * m;
      }
    }
    edges.forEach(([a, b]) => {
      if (a == null || b == null || a === b) return;
      const dx = pos[a][0] - pos[b][0];
      const dy = pos[a][1] - pos[b][1];
      const d = Math.hypot(dx, dy) || 1;
      const m = ((d - k) / d) * 0.5;
      f[a][0] -= (dx / d) * m * k;
      f[a][1] -= (dy / d) * m * k;
      f[b][0] += (dx / d) * m * k;
      f[b][1] += (dy / d) * m * k;
    });
    for (let i = 0; i < count; i += 1) {
      pos[i][0] += f[i][0] * 0.08;
      pos[i][1] += f[i][1] * 0.08;
    }
  }
  return pos;
}

const STATE_FILL = getFleetStateChartColors();

export function CouplingGraphPreview({ backendId, edges, qubitRows, topologyHref }) {
  const option = useMemo(() => {
    if (!edges?.length) return null;
    const stateByIdx = Object.fromEntries(qubitRows.map((q) => [q.qubit_index, q.state || 'UNKNOWN']));
    const involved = new Set();
    edges.forEach((e) => {
      involved.add(e.source_qubit);
      involved.add(e.target_qubit);
    });
    const ids = [...involved].sort((a, b) => a - b);
    if (!ids.length) return null;
    const posIdx = new Map(ids.map((id, i) => [id, i]));
    const linkPairs = edges
      .map((e) => [posIdx.get(e.source_qubit), posIdx.get(e.target_qubit)])
      .filter(([a, b]) => a != null && b != null && a !== b);
    const positions = layoutNodes(ids.length, linkPairs);
    const data = ids.map((id, i) => ({
      id: String(i),
      name: `Q${id}`,
      x: positions[i][0],
      y: positions[i][1],
      symbolSize: ids.length > 120 ? 14 : 20,
      itemStyle: { color: STATE_FILL[stateByIdx[id]] || STATE_FILL.UNKNOWN },
    }));
    const links = linkPairs.map(([a, b]) => ({ source: String(a), target: String(b) }));
    return {
      animation: false,
      tooltip: { show: true },
      series: [{
        type: 'graph',
        layout: 'none',
        roam: true,
        data,
        links,
        label: { show: ids.length <= 64, fontSize: 9, color: getChartInkColor() },
        lineStyle: { width: 1.2, opacity: 0.65 },
        emphasis: { focus: 'adjacency' },
      }],
    };
  }, [edges, qubitRows]);

  if (!option) return null;

  return (
    <section className="bd-coupling-graph" aria-label="Coupling graph preview">
      <div className="bd-coupling-graph__head">
        <h4>Coupling graph</h4>
        {topologyHref ? (
          <Link className="btn btn-secondary btn--xs" to={topologyHref}>Expand in topology map</Link>
        ) : null}
      </div>
      <QtECharts option={option} style={{ height: Math.min(420, 160 + edges.length), width: '100%' }} />
      <p className="page-hint">Node colour = qubit health · pan and zoom enabled · {backendId}</p>
    </section>
  );
}