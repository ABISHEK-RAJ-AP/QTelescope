import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QtECharts } from '../components/observability/QtECharts.jsx';
import { Download, Upload, Inbox, FileJson, Settings } from 'lucide-react';
import { api } from '../services/api';
import { BoneyardSkeleton } from '../components/ui/Skeleton';
import { RefreshButton } from '../components/ui/RefreshButton.jsx';
import { useTheme } from '../components/ui/ThemeProvider';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { InfoTooltip } from '../components/observability/InfoTooltip.jsx';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { getChartTheme, baseTooltip } from '../components/observability/chartTheme.js';
import { buildBackendDetailsPath } from '../lib/investigationLinks.js';
import { usePageActions } from '../context/PageActionsContext.jsx';
import { formatISTTime } from '../utils/time';
import './EnvironmentPage.css';

const downloadJson = (filename, obj) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const SOURCE_LABEL = {
  calibration_snapshot: 'Derived from calibration snapshot',
  vendor_calibration: 'Vendor calibration properties',
  import: 'Imported file',
  rest: 'REST ingest',
  inbox: 'Facility inbox',
};
const sourceLabel = (s) => SOURCE_LABEL[s] || s || 'Unknown source';
const sourceTone = (s) => (s === 'calibration_snapshot' || s === 'vendor_calibration' ? 'derived' : 'imported');

const ts = (s) => (s && !/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? `${s}Z` : s);
const age = (s) => {
  const ms = Date.now() - new Date(ts(s)).getTime();
  if (!Number.isFinite(ms)) return '—';
  const h = ms / 3.6e6;
  if (h < 1) return `${Math.max(1, Math.round(ms / 6e4))} min ago`;
  return h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} d ago`;
};
const STALE_HOURS = 24;
const isStale = (s) => (Date.now() - new Date(ts(s)).getTime()) / 3.6e6 > STALE_HOURS;

// 295000 mK is room temperature, not a cryostat reading: say so instead of a bare number.
function display(sample) {
  if (sample.channel === 'cryo_temp_mK' && sample.value >= 1000) {
    return { text: `${(sample.value / 1000).toFixed(0)} K`, note: 'Room temperature, not a cryostat reading' };
  }
  return { text: `${Number(sample.value)} ${sample.unit || ''}`.trim(), note: null };
}

export const EnvironmentPage = () => {
  const nav = useNavigate();
  const { resolved } = useTheme();
  const [data, setData] = useState({ samples: [], channels: [] });
  const [msg, setMsg] = useState(null);
  const [ingestStatus, setIngestStatus] = useState(null);
  const [adapterStatus, setAdapterStatus] = useState(null);
  const [backends, setBackends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [channel, setChannel] = useState(null);
  const fileRef = useRef(null);
  const { setActions, clearActions } = usePageActions();

  const load = useCallback(() => Promise.all([
    api.getEnvironment().then(setData),
    api.getEnvironmentIngestStatus().then(setIngestStatus).catch(() => null),
    api.getEnvironmentAdapterStatus().then(setAdapterStatus).catch(() => null),
    api.getBackends().then(setBackends).catch(() => []),
  ]).then(() => setLastRefresh(new Date())).catch(console.error).finally(() => setLoading(false)), []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setActions(<RefreshButton onClick={load} lastRefreshAt={lastRefresh} label="Refresh environment" />);
    return () => clearActions();
  }, [load, lastRefresh, setActions, clearActions]);

  const samples = useMemo(() => data.samples || [], [data]);
  const channels = useMemo(() => data.channels || [], [data]);
  const backendIds = useMemo(
    () => [...new Set([...backends.map((b) => b.backend_id), ...samples.map((s) => s.backend_id)])],
    [backends, samples],
  );
  const backendName = (id) => backends.find((b) => b.backend_id === id)?.backend_name || id;

  const latest = useMemo(() => {
    const m = {};
    samples.forEach((s) => {
      const k = `${s.backend_id}|${s.channel}`;
      if (!m[k] || new Date(ts(s.timestamp)) > new Date(ts(m[k].timestamp))) m[k] = s;
    });
    return m;
  }, [samples]);

  const activeChannel = channel || channels.find((c) => samples.some((s) => s.channel === c)) || channels[0];
  const series = useMemo(() => {
    const groups = {};
    samples.filter((s) => s.channel === activeChannel && !(s.channel === 'cryo_temp_mK' && s.value >= 1000)).forEach((s) => {
      const k = `${backendName(s.backend_id)} · ${sourceLabel(s.source)}`;
      (groups[k] = groups[k] || []).push([new Date(ts(s.timestamp)).getTime(), s.value]);
    });
    return Object.entries(groups).map(([name, d]) => ({ name, data: d.sort((a, b) => a[0] - b[0]) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, activeChannel, backends]);

  const coverageHeat = useMemo(() => {
    const ys = backendIds.map((id) => backendName(id));
    const xs = channels;
    const cellVal = (id, c) => {
      const s = latest[`${id}|${c}`];
      if (!s) return 0;
      return sourceTone(s.source) === 'derived' ? 2 : 1;
    };
    return {
      ys,
      xs,
      data: backendIds.flatMap((id, y) => channels.map((c, x) => [x, y, cellVal(id, c)])),
    };
  }, [backendIds, channels, latest, backends]);

  const heatOption = useMemo(() => {
    const t = getChartTheme(resolved === 'dark');
    return {
      grid: { left: 120, right: 16, top: 16, bottom: 48 },
      tooltip: {
        ...baseTooltip(resolved === 'dark'),
        trigger: 'item',
        formatter: (p) => {
          const b = backendIds[p.data[1]];
          const ch = channels[p.data[0]];
          const s = latest[`${b}|${ch}`];
          if (!s) return `${backendName(b)} · ${ch}<br/>No sample`;
          const d = display(s);
          return `${backendName(b)} · ${ch}<br/>${d.text}<br/>${sourceLabel(s.source)} · ${formatISTTime(s.timestamp)}`;
        },
      },
      xAxis: { type: 'category', data: coverageHeat.xs, axisLabel: { color: t.textColor, rotate: 30, fontSize: 10 }, axisLine: { lineStyle: { color: t.axisLine } } },
      yAxis: { type: 'category', data: coverageHeat.ys, axisLabel: { color: t.textColor, width: 110, overflow: 'truncate' }, axisLine: { lineStyle: { color: t.axisLine } } },
      visualMap: {
        type: 'piecewise', orient: 'horizontal', left: 'center', bottom: 0, textStyle: { color: t.textColor },
        pieces: [
          { value: 0, label: '— none', color: '#64748b' },
          { value: 1, label: '✓ imported', color: '#38bdf8' },
          { value: 2, label: '◔ derived', color: '#fbbf24' },
        ],
        dimension: 2,
      },
      series: [{
        type: 'heatmap',
        data: coverageHeat.data,
        label: { show: backendIds.length * channels.length <= 40, formatter: (p) => ['—', '✓', '◔'][p.data[2]], color: '#0b1220', fontSize: 10 },
        itemStyle: { borderColor: t.splitColor, borderWidth: 1 },
      }],
    };
  }, [coverageHeat, resolved, backendIds, channels, latest, backends]);

  const onHeatClick = (p) => {
    const ch = channels[p?.data?.[0]];
    const b = backendIds[p?.data?.[1]];
    if (ch) setChannel(ch);
    if (b) nav({ pathname: buildBackendDetailsPath(b), search: `?backend=${encodeURIComponent(b)}` });
  };

  const option = useMemo(() => {
    const t = getChartTheme(resolved === 'dark');
    const unit = samples.find((s) => s.channel === activeChannel)?.unit || '';
    return {
      grid: { left: 56, right: 16, top: 36, bottom: 32 },
      legend: { textStyle: { color: t.textColor }, top: 0, type: 'scroll' },
      tooltip: baseTooltip(resolved === 'dark'),
      xAxis: { type: 'time', axisLabel: { color: t.textColor }, axisLine: { lineStyle: { color: t.axisLine } } },
      yAxis: { type: 'value', name: unit, nameTextStyle: { color: t.textColor }, scale: true, axisLabel: { color: t.textColor }, splitLine: { lineStyle: { color: t.splitColor } } },
      series: series.map((s) => ({ ...s, type: 'line', symbolSize: 8, lineStyle: { width: 2 } })),
    };
  }, [series, resolved, activeChannel, samples]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { assertImportSize } = await import('../lib/clientVitals.js');
      assertImportSize(file.size);
      const res = await api.importEnvironment(JSON.parse(await file.text()));
      setMsg(`Imported ${res.imported} samples.`);
      load();
    } catch (err) {
      setMsg(String(err));
    }
  };

  if (loading) return <BoneyardSkeleton layout="table-plain" />;

  const covered = Object.keys(latest).length;
  const mqttStatus = ingestStatus?.mqtt_subscriber || 'DISABLED';
  const cryoStatus = adapterStatus?.vendor_cryo_rf_adapter || ingestStatus?.vendor_cryo_rf_adapter || 'IDLE';
  const paths = ingestStatus ? [
    ['REST ingest', ingestStatus.rest_ingest],
    ['JSON import', ingestStatus.file_import],
    ['Inbox scan', ingestStatus.inbox_scan],
    ['MQTT', mqttStatus],
    ['Vendor cryo/RF adapter', cryoStatus],
  ] : [];

  return (
    <div className="page-stack">
      <section className="card page-panel env-sources" role="status">
        <div className="env-sources__row">
          <h3 className="chart-panel__title env-sources__title">
            Facility sensors
            <InfoTooltip label="How these samples arrive">
              <p style={{ margin: '0 0 8px' }}>Facility telemetry is pushed or imported, not streamed from hardware.</p>
              <p style={{ margin: '0 0 8px' }}>{covered} of {backendIds.length * channels.length} backend/channel pairs have a sample. Values labelled derived come from calibration snapshots, not facility sensors.</p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {paths.map(([label, status]) => <li key={label}>{label}: {status}</li>)}
              </ul>
            </InfoTooltip>
          </h3>
          <span className="env-coverage">{covered} / {backendIds.length * channels.length} sampled</span>
          {ingestStatus?.inbox_pending_files > 0 && (
            <span className="env-coverage">{ingestStatus.inbox_pending_files} inbox pending</span>
          )}
        </div>
        <div className="env-icon-bar" role="toolbar" aria-label="Environment data actions">
          <button type="button" className="env-icon-btn" title="Scan facility inbox" aria-label="Scan inbox" onClick={async () => {
            const res = await api.scanEnvironmentInbox();
            setMsg(`Inbox: ${res.files_processed} file(s), ${res.records_added} record(s).`);
            load();
          }}><Inbox size={18} aria-hidden /></button>
          <button type="button" className="env-icon-btn" title="Import JSON file" aria-label="Import JSON" onClick={() => fileRef.current?.click()}><Upload size={18} aria-hidden /></button>
          <button type="button" className="env-icon-btn" title="Download import template" aria-label="Download template" onClick={async () => downloadJson('environment_template.json', await api.getEnvironmentTemplate())}><FileJson size={18} aria-hidden /></button>
          <button type="button" className="env-icon-btn" title="Export all samples" aria-label="Export JSON" onClick={async () => downloadJson('environment_export.json', await api.exportEnvironment())}><Download size={18} aria-hidden /></button>
          <button type="button" className="env-icon-btn" title="Collector settings" aria-label="Admin collectors" onClick={() => nav('/app/admin/collectors')}><Settings size={18} aria-hidden /></button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={onFile} />
        </div>
        {msg && <p className="page-status-msg" role="status">{msg}</p>}
      </section>

      <ChartPanel
        title="Coverage map"
        question="Imported vs derived samples by backend and channel."
        sourceKind="imported"
        state={backendIds.length && channels.length ? 'ready' : 'empty'}
        emptyMessage="No backends or channels configured."
        minHeight={320}
      >
        <QtECharts option={heatOption} style={{ height: Math.max(280, backendIds.length * 36 + 80), width: '100%' }} onEvents={{ click: onHeatClick }} notMerge />
      </ChartPanel>

      <section className="card" style={{ padding: 0 }}>
        <div className="env-matrix-head">
          <h3 className="chart-panel__title env-sources__title">
            Coverage by backend and channel
            <InfoTooltip label="What each cell shows">
              Latest value, age, and source. Imported values came from a file or API push. Derived values come from calibration snapshots, not facility sensors.
            </InfoTooltip>
          </h3>
        </div>
        <div className="env-matrix-wrap">
          <table className="env-matrix">
            <thead>
              <tr><th scope="col">Backend</th>{channels.map((c) => <th scope="col" key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {backendIds.map((id) => (
                <tr key={id}>
                  <th scope="row">
                    <button type="button" className="env-link" onClick={() => nav({ pathname: buildBackendDetailsPath(id), search: `?backend=${encodeURIComponent(id)}` })}>{backendName(id)}</button>
                  </th>
                  {channels.map((c) => {
                    const s = latest[`${id}|${c}`];
                    if (!s) return <td key={c} className="env-cell env-cell--none" aria-label="No data">—</td>;
                    const d = display(s);
                    const stale = isStale(s.timestamp);
                    return (
                      <td key={c} className={`env-cell env-cell--${sourceTone(s.source)}${stale ? ' env-cell--stale' : ''}`}>
                        <button type="button" className="env-cell__btn" onClick={() => setChannel(c)} title={`${sourceLabel(s.source)} · ${formatISTTime(s.timestamp)}`}>
                          <span className="env-cell__val">{d.text}</span>
                          <span className="env-cell__meta">{age(s.timestamp)}{stale ? ' · stale' : ''}</span>
                          <span className="env-cell__meta">{sourceTone(s.source) === 'derived' ? 'derived' : 'imported'}</span>
                          {d.note && <span className="env-cell__warn">{d.note}</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="page-hint" style={{ margin: '0 16px 14px' }}>
          Empty cells indicate no sample (not a nominal reading). Stale: older than {STALE_HOURS} h. Facility channels have no alert thresholds, so OK/breach is not shown.
        </p>
      </section>

      <ChartPanel
        title={`History: ${activeChannel || '—'}`}
        question="Channel history split by backend and source."
        sourceKind="imported"
        state={series.some((s) => s.data.length) ? 'ready' : 'empty'}
        emptyTitle="No plottable samples"
        emptyMessage="Nothing for this channel yet, or only room-temperature derived values (excluded from the cryo axis)."
        minHeight={360}
        actions={(
          <select aria-label="Channel" value={activeChannel || ''} onChange={(e) => setChannel(e.target.value)} className="env-select">
            {channels.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        tableAlternative={(
          <table className="custom-table custom-table--dense">
            <thead><tr><th>Time</th><th>Backend</th><th>Channel</th><th>Value</th><th>Unit</th><th>Source</th></tr></thead>
            <tbody>
              {samples.map((s, i) => (
                <tr key={i}>
                  <td>{s.timestamp ? formatISTTime(s.timestamp) : '—'}</td><td>{s.backend_id}</td><td>{s.channel}</td>
                  <td>{s.value}</td><td>{s.unit || '—'}</td><td>{sourceLabel(s.source)}</td>
                </tr>
              ))}
              {samples.length === 0 && <tr><td colSpan={6}><EmptyState variant="inline" compact title="No samples" message="Import JSON or ingest via API." /></td></tr>}
            </tbody>
          </table>
        )}
      >
        <QtECharts option={option} style={{ height: 360, width: '100%' }} notMerge />
      </ChartPanel>
    </div>
  );
};
