import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Maximize2 } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip.jsx';
import { EmptyState } from './EmptyState.jsx';
import { ErrorState } from './ErrorState.jsx';
import { BoneyardSkeleton } from '../ui/Skeleton.jsx';
import { ChartExpandModal } from './ChartExpandModal.jsx';
import { EMPTY_CHART } from '../../constants/messages.js';

/**
 * Chart container with honest loading / empty / error states (Sprint 1).
 * children: chart when state === 'ready'
 * titleTo: entire chart section navigates via the title (replaces separate "Open …" links).
 */
export function ChartPanel({
  title,
  titleTo,
  question,
  help,
  asOf,
  provenanceDetail,
  state = 'ready',
  emptyTitle,
  emptyMessage,
  emptyAction,
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

  const tooltipBody = [help || question, asOf ? `As of ${asOf}` : '', provenanceDetail || ''].filter(Boolean).join(' ');
  const showTooltip = Boolean(tooltipBody);
  const showQuestion = Boolean(question) && !titleTo;

  const inlineStage = state === 'ready' && children ? (
    <div className="chart-panel__stage">{children}</div>
  ) : null;

  const expandStage = state === 'ready' && children ? (
    <div className="chart-expand__stage">{children}</div>
  ) : null;

  const titleNode = title && (
    titleTo ? (
      <Link to={titleTo} className="chart-panel__title chart-panel__title--link">
        {title}
      </Link>
    ) : (
      <h3 className="chart-panel__title">{title}</h3>
    )
  );

  return (
    <section className="chart-panel card" aria-labelledby={title ? undefined : undefined}>
      <header className="chart-panel__head">
        <div className="chart-panel__titles">
          <div className="chart-panel__title-row">
            {titleNode}
            {showTooltip && (
              <InfoTooltip label={`About ${title || 'this chart'}`}>
                <div className="chart-panel__tooltip-body">{tooltipBody}</div>
              </InfoTooltip>
            )}
          </div>
          {showQuestion && <p className="chart-panel__question">{question}</p>}
        </div>
        <div className="chart-panel__meta">
          {actions}
          {showExpand && (
            <button
              type="button"
              className="chart-panel__expand btn btn-secondary btn-icon-only"
              aria-label={`Expand chart: ${title || 'visualization'}`}
              title="Expand"
              onClick={() => setPresentOpen(true)}
            >
              <Maximize2 size={18} aria-hidden />
            </button>
          )}
        </div>
      </header>
      <div
        className="chart-panel__body"
        style={{ minHeight }}
        aria-hidden={presentOpen}
      >
        {state === 'loading' && <BoneyardSkeleton layout="chart" />}
        {state === 'error' && (
          <ErrorState variant="panel" compact message={errorMessage} onRetry={onRetry} />
        )}
        {state === 'empty' && (
          <EmptyState
            variant="panel"
            compact
            title={emptyTitle || EMPTY_CHART.title}
            message={emptyMessage || EMPTY_CHART.message}
            action={emptyAction}
          />
        )}
        {state === 'ready' && !presentOpen && inlineStage}
        {state === 'ready' && presentOpen && (
          <div className="chart-panel__placeholder" aria-hidden>
            Chart expanded — close the presentation view to return here.
          </div>
        )}
      </div>
      {tableAlternative && state === 'ready' && (
        <details className="chart-panel__table-alt">
          <summary>Show data table</summary>
          {tableAlternative}
        </details>
      )}
      {presentOpen && typeof document !== 'undefined' && createPortal(
        <ChartExpandModal title={title} question={question} onClose={() => setPresentOpen(false)}>
          {expandStage}
        </ChartExpandModal>,
        document.body,
      )}
    </section>
  );
}
