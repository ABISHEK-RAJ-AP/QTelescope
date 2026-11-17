import { useEffect, useMemo, useState } from 'react';
import DraggableWidgetGrid from './ui/draggable-widget-grid.jsx';
import {
  mergeSavedOrder,
  readWidgetLayout,
  widgetsForLens,
  writeWidgetLayout,
} from '../lib/overviewWidgetLayout.js';
import { buildOverviewKpis } from '../lib/overviewKpis.js';
import { KpiStrip, EmptyState, QuotaMeter, StatusBadge, WorkloadLink } from './ui.jsx';
import ListViewToolbar from './ListViewToolbar.jsx';
import AdaptiveListView from './AdaptiveListView.jsx';
import { useTablePrefs } from '../hooks/useTablePrefs.js';
import { approvalGridFields } from '../lib/approvalListGrid.jsx';
import { DonutMix, mixFromCounts } from './GovernCharts.jsx';
import { relativeTime } from '../lib/format.js';

const OVERVIEW_COLS = [
  { id: 'status', label: 'Status' },
  { id: 'workload', label: 'Workload' },
  { id: 'stage', label: 'Stage' },
  { id: 'actions', label: 'Actions' },
];

function WidgetChrome({ title, meta, children }) {
  return (
    <div className="govern-overview-widget">
      <header className="govern-overview-widget__head">
        <h3 className="govern-section-title">{title}</h3>
        {meta ? <div className="govern-overview-widget__meta">{meta}</div> : null}
      </header>
      <div className="govern-overview-widget__body">{children}</div>
    </div>
  );
}

export default function OverviewDashboardGrid({
  lens,
  data,
  recent,
  myCount,
  activity,
  quota,
  permissions,
  showAdmissionMix,
  showQuota,
  activityFirst,
  onOpen,
}) {
  const canMeter = permissions.includes('metering:read') || permissions.includes('reports:read');
  const canDecide = permissions.includes('approvals:decide');
  const prefs = useTablePrefs('overview-recent', OVERVIEW_COLS);

  const baseWidgets = useMemo(
    () => widgetsForLens(lens, { showAdmissionMix, showQuota, activityFirst }),
    [lens, showAdmissionMix, showQuota, activityFirst],
  );

  const [widgetItems, setWidgetItems] = useState(() =>
    mergeSavedOrder(baseWidgets, readWidgetLayout(lens)),
  );

  useEffect(() => {
    setWidgetItems(mergeSavedOrder(baseWidgets, readWidgetLayout(lens)));
  }, [lens, baseWidgets]);

  const kpis = buildOverviewKpis({ lens, data, myCount, permissions, onOpen });

  function renderWidget(item) {
    switch (item.id) {
      case 'kpis':
        return (
          <WidgetChrome title="Operational summary">
            <KpiStrip items={kpis} />
          </WidgetChrome>
        );
      case 'queue':
        return (
          <WidgetChrome
            title="Needs review"
            meta={<span className="govern-status govern-status--warn">{data.queue} waiting</span>}
          >
            {recent.length === 0 ? (
              <EmptyState
                title="Queue is clear"
                hint="Submitted workloads appear here for institutional review."
                action={
                  <button type="button" className="qre-btn qre-btn--primary" onClick={() => onOpen('#/queue')}>
                    Open queue
                  </button>
                }
              />
            ) : (
              <>
                {recent.length > 0 ? (
                  <ListViewToolbar prefs={prefs} columns={OVERVIEW_COLS} lockedIds={['workload']} />
                ) : null}
                <AdaptiveListView
                  prefs={prefs}
                  items={recent}
                  columns={OVERVIEW_COLS}
                  rowKey={(row) => row.submission_id}
                  onRowClick={(row) => onOpen(`#/queue/${row.workload_id}`)}
                  gridFields={approvalGridFields(onOpen, { actionLabel: 'Review' })}
                  table={
                    <div className="govern-table-wrap">
                      <table className="govern-table govern-table--compact">
                        <thead>
                          <tr>
                            {prefs.isVisible('status') && <th>Status</th>}
                            {prefs.isVisible('workload') && <th>Workload</th>}
                            {prefs.isVisible('stage') && <th>Stage</th>}
                            {prefs.isVisible('actions') && <th />}
                          </tr>
                        </thead>
                        <tbody>
                          {recent.map((item) => {
                            const stage = item.governance_progress?.current_stage?.label || 'Review';
                            const index = (item.governance_progress?.stage_index ?? 0) + 1;
                            const total = item.governance_progress?.stage_total || 1;
                            return (
                              <tr key={item.submission_id}>
                                {prefs.isVisible('status') && (
                                  <td>
                                    <StatusBadge state={item.governance_state} />
                                  </td>
                                )}
                                {prefs.isVisible('workload') && (
                                  <td>
                                    <WorkloadLink workloadId={item.workload_id} onOpen={onOpen} />
                                  </td>
                                )}
                                {prefs.isVisible('stage') && (
                                  <td>
                                    {stage}
                                    <span className="govern-table__sub">
                                      {index} of {total}
                                    </span>
                                  </td>
                                )}
                                {prefs.isVisible('actions') && (
                                  <td>
                                    <button
                                      type="button"
                                      className="qre-btn qre-btn--ghost qre-btn--sm"
                                      onClick={() => onOpen(`#/queue/${item.workload_id}`)}
                                    >
                                      Review
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  }
                />
                <button type="button" className="qre-btn qre-btn--ghost" style={{ marginTop: 8 }} onClick={() => onOpen('#/queue')}>
                  View full queue
                </button>
              </>
            )}
          </WidgetChrome>
        );
      case 'actions':
        return (
          <WidgetChrome title="Action centre">
            <p className="govern-muted govern-overview-widget__lede">
              {lens === 'researcher'
                ? 'Track submissions and reservations.'
                : lens === 'governance_ops'
                  ? 'Dispatch checks provider manifest and suspension.'
                  : 'Shortcuts along the governance pipeline.'}
            </p>
            <nav className="link-row page-related-nav govern-overview-widget__links" aria-label="Related">
              <button type="button" className="fs-link" onClick={() => onOpen('#/queue')}>
                Review queue
              </button>
              {lens !== 'researcher' && lens !== 'viewer' && (
                <button type="button" className="fs-link" onClick={() => onOpen('#/reservations')}>
                  Holds
                </button>
              )}
              {canDecide && (
                <button type="button" className="fs-link" onClick={() => onOpen('#/allocation')}>
                  Dispatch
                </button>
              )}
              <button type="button" className="fs-link" onClick={() => onOpen('#/audit')}>
                Audit
              </button>
              {(lens === 'platform_admin' || lens === 'governance_ops') && canMeter && (
                <button type="button" className="fs-link" onClick={() => onOpen('#/usage')}>
                  Usage
                </button>
              )}
            </nav>
          </WidgetChrome>
        );
      case 'admission': {
        const mix = mixFromCounts(data.counts);
        if (mix.preview) {
          return (
            <WidgetChrome title="Admission mix">
              <EmptyState title="No mix yet" hint="Counts appear when the queue has submissions." />
            </WidgetChrome>
          );
        }
        return (
          <WidgetChrome title="Admission mix" meta={<span className="govern-muted">Current queue</span>}>
            <DonutMix slices={mix.slices} />
          </WidgetChrome>
        );
      }
      case 'quota':
        if (quota?.daily_shots_cap) {
          return (
            <WidgetChrome title="Shot quota">
              <QuotaMeter
                used={quota.used_shots}
                cap={quota.daily_shots_cap}
                remaining={quota.remaining_shots}
                warnPct={quota.warn_threshold_pct ?? 20}
              />
            </WidgetChrome>
          );
        }
        return (
          <WidgetChrome title="Shot quota">
            <EmptyState title="No cap configured" hint="Tenant caps come from policy evaluate." />
          </WidgetChrome>
        );
      case 'activity':
        return (
          <WidgetChrome
            title="Recent activity"
            meta={
              <button type="button" className="qre-btn qre-btn--ghost qre-btn--sm" onClick={() => onOpen('#/audit')}>
                Audit
              </button>
            }
          >
            {activity.length === 0 ? (
              <EmptyState title="No events" hint="Governance actions appear in the audit trail." />
            ) : (
              <ul className="qre-activity-list">
                {activity.map((ev) => (
                  <li key={ev.id} className="qre-activity-list__item">
                    <span className="govern-muted">{relativeTime(ev.timestamp)}</span>
                    <div style={{ marginTop: 4 }}>
                      <strong>{ev.actor}</strong> · {ev.action?.replace('approval.', '')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </WidgetChrome>
        );
      default:
        return null;
    }
  }

  return (
    <DraggableWidgetGrid
      className="govern-overview-grid"
      items={widgetItems}
      maxColumns={4}
      cellSize={220}
      gap={12}
      radius={12}
      editable
      onChange={(next) => {
        setWidgetItems(next);
        writeWidgetLayout(lens, next);
      }}
      renderItem={renderWidget}
    />
  );
}