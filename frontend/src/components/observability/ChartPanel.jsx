import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2 } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip.jsx';
import { ProvenanceChip } from './ProvenanceChip.jsx';
import { EmptyState } from './EmptyState.jsx';
import { ErrorState } from './ErrorState.jsx';
import { BoneyardSkeleton } from '../ui/Skeleton.jsx';
import { ChartExpandModal } from './ChartExpandModal.jsx';

/**
 * Chart container with honest loading / empty / error states (Sprint 1).
 * children: chart when state === 'ready'
 */
export function ChartPanel({
  title,
  question,
  help,
  sourceKind,
  asOf,
  provenanceDetail,
  state = 'ready',
  emptyTitle,
  emptyMessage,
  errorMessage,
  onRetry,
  actions,
  minHeight = 240,
  tableAlternative,
  expandable = true,
  children,
}) {
  const [presentOpen, setPresentOpen] = useState(false);
  const showExpand = expandable && state === 'ready';

  useEffect(() => {
    if (!presentOpen) return undefined;
    const t1 = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    const t2 = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 280);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [presentOpen]);

  const stage = state === 'ready' && children ? (
    <div className="chart-expand__stage">{children}</div>
  ) : null;

  return (
    <section className="chart-panel card" aria-labelledby={title ? undefined : undefined}>
      <header className="chart-panel__head">
        <div className="chart-panel__titles">
          {title && <h3 className="chart-panel__title">{title}</h3>}
          {question && <p className="chart-panel__question">{question}</p>}
        </div>
        <div className="chart-panel__meta">
          {sourceKind && (
            <ProvenanceChip kind={sourceKind} asOf={asOf} detail={provenanceDetail} compact />
          )}
          {help && (
            <InfoTooltip label="Chart help">
              <div style={{ fontSize: '0.75rem', maxWidth: 280 }}>{help}</div>
            </InfoTooltip>
          )}
          {showExpand && (
            <button
              type="button"
              className="chart-panel__expand btn btn-secondary btn-icon-only"
              aria-label={`Expand chart: ${title || 'visualization'}`}
              title="Expand for presentation"
              onClick={() => setPresentOpen(true)}
            >
              <Maximize2 size={16} aria-hidden />
            </button>
          )}
          {actions}
        </div>
      </header>
      <div className="chart-panel__body" style={{ minHeight }} aria-hidden={presentOpen}>
        {state === 'loading' && <BoneyardSkeleton layout="grid" />}
        {state === 'error' && (
          <ErrorState variant="panel" compact message={errorMessage} onRetry={onRetry} />
        )}
        {state === 'empty' && (
          <EmptyState
            variant="panel"
            compact
            title={emptyTitle || 'No series'}
            message={emptyMessage || 'No data for this selection.'}
          />
        )}
        {state === 'ready' && !presentOpen && children}
        {state === 'ready' && presentOpen && (
          <div className="chart-panel__placeholder" aria-hidden>
            Chart expanded — close the presentation view to return here.
          </div>
        )}
      </div>
      {tableAlternative && state === 'ready' && (
        <details className="chart-panel__table-alt">
          <summary>View underlying data</summary>
          {tableAlternative}
        </details>
      )}
      {presentOpen && typeof document !== 'undefined' && createPortal(
        <ChartExpandModal title={title} question={question} onClose={() => setPresentOpen(false)}>
          {stage}
        </ChartExpandModal>,
        document.body,
      )}
    </section>
  );
}
