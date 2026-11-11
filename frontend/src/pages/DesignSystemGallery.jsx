import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
import { FleetKpiStrip } from '../components/dashboard/FleetKpiStrip.jsx';
import { ChartPanel } from '../components/observability/ChartPanel.jsx';
import { EmptyState } from '../components/observability/EmptyState.jsx';
import { ErrorState } from '../components/observability/ErrorState.jsx';
import { BoneyardSkeleton } from '../components/ui/Skeleton.jsx';
import { ScopeBanner } from '../components/ds/ScopeBanner.jsx';
import { FilterBar } from '../components/ds/FilterBar.jsx';
import { FLEET_TELEMETRY_EMPTY } from '../constants/messages.js';
import { SevBadge } from './opsShared.jsx';
import { DataSourceBadge } from '../components/observability/DataSourceBadge.jsx';
import './DesignSystemGallery.css';

const DEMO_KPIS = [
  { id: 'a', label: 'Backends online', value: 4, hint: 'Hardware only', to: '/app/backends/inventory' },
  { id: 'b', label: 'Open incidents', value: 1, hint: 'Act now', tone: 'warn', to: '/app/alerts/incidents' },
  { id: 'c', label: 'Critical alerts', value: 2, hint: 'Grouped by rule', tone: 'crit', to: '/app/alerts' },
  { id: 'd', label: 'Pending jobs', value: 9, hint: 'Queue telemetry', to: '/app/execution/queues' },
];

export function DesignSystemGallery() {
  const [chartState, setChartState] = useState('ready');
  const [filterQ, setFilterQ] = useState('');

  return (
    <div className="page-stack design-gallery">
      <header className="design-gallery__intro card">
        <h1 className="design-gallery__title">Design gallery</h1>
        <p className="design-gallery__sub">
          Living style guide on the <strong>current</strong> stack (tokens + observability components).
          Hidden from production nav — bookmark <code>/app/design</code>.
        </p>
        <p className="page-hint">
          See <code>docs/product/DESIGN_FOUNDATION_PLAN.md</code> before adopting shadcn/Carbon.
        </p>
      </header>

      <section className="design-gallery__section card">
        <h2 className="design-gallery__h">KPI strip (max 4–6)</h2>
        <FleetKpiStrip items={DEMO_KPIS} />
      </section>

      <section className="design-gallery__section card">
        <h2 className="design-gallery__h">Status (icon + label; chip when action needed)</h2>
        <div className="design-gallery__row">
          <SevBadge severity="CRITICAL" />
          <SevBadge severity="WARNING" />
          <span className="design-gallery__plain-status">
            <CheckCircle2 size={16} aria-hidden /> Online — plain text when no action
          </span>
          <DataSourceBadge kind="stale" />
        </div>
      </section>

      <section className="design-gallery__section">
        <ScopeBanner
          title="Stale measurements"
          variant="warn"
          items={[{ term: 'Telemetry', detail: 'Last sample 5.8 h ago — calibration may still show Fresh until next collection.' }]}
          action={<Link className="btn btn-secondary btn--xs" to="/app/admin/collectors">Collectors</Link>}
        />
      </section>

      <section className="design-gallery__section card">
        <h2 className="design-gallery__h">Filter bar</h2>
        <FilterBar
          search={filterQ}
          onSearchChange={setFilterQ}
          searchPlaceholder="Search backends"
          count={filterQ ? `Query “${filterQ}”` : '4 backends'}
        />
      </section>

      <section className="design-gallery__section card">
        <h2 className="design-gallery__h">Chart panel states</h2>
        <div className="design-gallery__chips">
          {['ready', 'loading', 'empty', 'error'].map((s) => (
            <button key={s} type="button" className={`btn btn-secondary btn--xs${chartState === s ? ' is-on' : ''}`} onClick={() => setChartState(s)}>
              {s}
            </button>
          ))}
        </div>
        <ChartPanel
          title="Example chart"
          question="Presentation dashboards: one question per chart."
          state={chartState}
          emptyTitle={FLEET_TELEMETRY_EMPTY.title}
          emptyMessage="Collecting data — first points after the next successful collection run (~15 min)."
          emptyAction={<Link className="btn btn-primary btn--xs" to="/app/admin/integrations">Connect provider</Link>}
          errorMessage="Could not load chart data. Retry or open Platform health."
          onRetry={() => setChartState('ready')}
          minHeight={200}
        >
          <div className="design-gallery__fake-chart" role="img" aria-label="Placeholder chart">
            <Activity size={32} aria-hidden />
            <span>Chart mounts here (ECharts)</span>
          </div>
        </ChartPanel>
      </section>

      <section className="design-gallery__section card design-gallery__grid-2">
        <div>
          <h2 className="design-gallery__h">Empty</h2>
          <EmptyState
            title={FLEET_TELEMETRY_EMPTY.title}
            message="Pending system update — Carbon empty type."
            action={<Link className="btn btn-primary btn--xs" to="/app/admin/collectors">Run collection</Link>}
          />
        </div>
        <div>
          <h2 className="design-gallery__h">Error</h2>
          <ErrorState variant="panel" message="Connection timed out. Check network and retry." onRetry={() => {}} />
        </div>
        <div>
          <h2 className="design-gallery__h">Skeleton</h2>
          <BoneyardSkeleton layout="table" />
        </div>
        <div>
          <h2 className="design-gallery__h">Button spinner pattern</h2>
          <button type="button" className="btn btn-primary" disabled>
            <span className="design-gallery__spin" aria-hidden /> Saving…
          </button>
          <p className="page-hint">Use spinners on buttons; skeletons for panels (NN/g).</p>
        </div>
      </section>

      <section className="design-gallery__section card">
        <h2 className="design-gallery__h">Tokens snapshot</h2>
        <ul className="design-gallery__tokens">
          <li><span className="design-gallery__swatch" style={{ background: 'var(--ds-surface-page)' }} /> --ds-surface-page</li>
          <li><span className="design-gallery__swatch" style={{ background: 'var(--ds-primary)' }} /> --ds-primary</li>
          <li><span className="design-gallery__swatch" style={{ background: 'var(--ds-status-critical)' }} /> --ds-status-critical</li>
          <li><span className="design-gallery__swatch" style={{ background: 'var(--ds-status-healthy)' }} /> --ds-status-healthy</li>
        </ul>
        <p className="page-hint"><AlertTriangle size={14} style={{ verticalAlign: 'middle' }} aria-hidden /> Run <code>npm run check:tokens</code> before PR.</p>
      </section>
    </div>
  );
}
