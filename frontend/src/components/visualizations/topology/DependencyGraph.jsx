/**
 * Provider → backend dependency view (ECharts force graph).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Maximize2, RefreshCw } from 'lucide-react';
import { QtECharts } from '../../observability/QtECharts.jsx';
import { useTheme } from '../../ui/ThemeProvider';
import { getChartTheme, getChartSemanticColors, baseTooltip, chartLabelStyle } from '../../observability/chartTheme.js';
import { buildBackendDetailsPath } from '../../../lib/investigationLinks.js';
import '../shared/visualizations.css';

const statusColor = (status, sem) => {
  const s = (status || '').toUpperCase();
  if (s === 'OK' || s === 'OPERATIONAL' || s === 'GREEN') return sem.healthy;
  if (s === 'WARNING' || s === 'YELLOW' || s === 'DEGRADED') return sem.warn;
  if (s === 'CRITICAL' || s === 'RED' || s === 'FAILED') return sem.critical;
  return sem.unknown;
};

export function DependencyGraph({ platformData, className = '' }) {
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const nav = useNavigate();
  const chartRef = useRef(null);
  const wrapRef = useRef(null);
  const [chartHeight, setChartHeight] = useState(480);
  const [layoutKey, setLayoutKey] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const w = el.clientWidth || 800;
      setChartHeight(Math.max(420, Math.min(680, Math.round(w * 0.42))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const inst = chartRef.current?.getEchartsInstance?.();
    inst?.resize();
  }, [chartHeight, layoutKey]);

  const { option, nodes, isEmpty } = useMemo(() => {
    const th = getChartTheme(isDark);
    const sem = getChartSemanticColors();
    const dep = platformData?.dependency_links || [];
    if (!dep.length) {
      return { option: null, nodes: [], isEmpty: true };
    }

    const graphNodes = [];
    const links = [];
    const categories = [{ name: 'Provider' }, { name: 'Backend' }];

    dep.forEach((row) => {
      const pid = row.provider_id;
      graphNodes.push({
        id: `p:${pid}`,
        name: pid,
        category: 0,
        symbolSize: 46,
        itemStyle: { color: statusColor(row.collector_status, sem) },
        label: { show: true, fontSize: 11, color: th.textColor },
        meta: { type: 'provider', collector_status: row.collector_status },
      });
      (row.backends || []).forEach((b) => {
        const bid = b.backend_id;
        const nid = `b:${bid}`;
        if (!graphNodes.find((n) => n.id === nid)) {
          graphNodes.push({
            id: nid,
            name: b.backend_name || bid,
            category: 1,
            symbolSize: 30 + Math.min(14, (b.active_alerts || 0) * 2),
            itemStyle: { color: statusColor(b.operational_status, sem) },
            label: { show: true, fontSize: 10, color: th.textColor },
            meta: {
              type: 'backend',
              backend_id: bid,
              active_alerts: b.active_alerts,
              operational_status: b.operational_status,
            },
          });
        }
        links.push({
          source: `p:${pid}`,
          target: nid,
          lineStyle: { width: 1.5, opacity: 0.65 },
        });
      });
    });

    const opt = {
      backgroundColor: 'transparent',
      tooltip: {
        ...baseTooltip(isDark),
        formatter: (p) => {
          if (p.dataType === 'edge') return `${p.data.source} → ${p.data.target}`;
          const m = p.data?.meta || {};
          if (m.type === 'provider') {
            return `<strong>${p.data.name}</strong><br/>Collector: ${m.collector_status || '—'}`;
          }
          return `<strong>${p.data.name}</strong><br/>Status: ${m.operational_status || '—'}<br/>Active alerts: ${m.active_alerts ?? '—'}`;
        },
      },
      legend: { show: false },
      series: [{
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        categories,
        data: graphNodes,
        links,
        center: ['50%', '50%'],
        force: {
          repulsion: Math.max(140, graphNodes.length * 8),
          edgeLength: [90, 160],
          gravity: 0.06,
          layoutAnimation: true,
        },
        lineStyle: { color: th.splitColor, curveness: 0.12 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 3 } },
        label: { position: 'bottom', ...chartLabelStyle(isDark, 11) },
      }],
    };
    return { option: opt, nodes: graphNodes, isEmpty: false };
  }, [platformData, isDark, layoutKey]);

  const onChartClick = (params) => {
    const m = params?.data?.meta;
    if (m?.type === 'backend' && m.backend_id) {
      nav(buildBackendDetailsPath(m.backend_id));
    }
  };

  const relayout = useCallback(() => {
    setLayoutKey((k) => k + 1);
  }, []);

  const resizeChart = useCallback(() => {
    chartRef.current?.getEchartsInstance?.()?.resize();
  }, []);

  if (isEmpty) {
    return (
      <p className={`page-hint ${className}`}>
        No provider–backend links yet. Run collectors or check Administration → Collectors.
      </p>
    );
  }

  return (
    <div className={`viz-dependency-graph viz-dependency-graph--full ${className}`} ref={wrapRef}>
      <div className="viz-dependency-graph__toolbar">
        <span className="page-hint" style={{ margin: 0, flex: 1 }}>
          {nodes.length} nodes · drag to rearrange · scroll to zoom
        </span>
        <button type="button" className="btn btn-secondary btn--xs" onClick={relayout} aria-label="Reset graph layout">
          <RefreshCw size={14} aria-hidden /> Reset layout
        </button>
        <button type="button" className="btn btn-secondary btn--xs" onClick={resizeChart} aria-label="Fit graph to panel">
          <Maximize2 size={14} aria-hidden /> Fit panel
        </button>
      </div>
      <div className="viz-dependency-graph__canvas">
        <QtECharts
          ref={chartRef}
          option={option}
          style={{ height: chartHeight, width: '100%' }}
          onEvents={{ click: onChartClick }}
          notMerge
        />
      </div>
      <details className="viz-dependency-graph__table">
        <summary className="fs-link" style={{ cursor: 'pointer' }}>Table view</summary>
        <div className="table-container" style={{ marginTop: 10 }}>
          <table className="custom-table custom-table--dense">
            <thead>
              <tr><th>Provider</th><th>Backend</th><th>Status</th><th>Alerts</th></tr>
            </thead>
            <tbody>
              {(platformData?.dependency_links || []).flatMap((row) =>
                (row.backends || []).map((b) => (
                  <tr key={`${row.provider_id}-${b.backend_id}`}>
                    <td><code>{row.provider_id}</code></td>
                    <td><Link to={buildBackendDetailsPath(b.backend_id)}>{b.backend_name || b.backend_id}</Link></td>
                    <td>{b.operational_status || '—'}</td>
                    <td>{b.active_alerts ?? '—'}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
