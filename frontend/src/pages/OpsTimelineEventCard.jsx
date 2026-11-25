import React from 'react';
import { formatIST } from '../utils/time';
import { EntityFlipCard } from '../components/observability/EntityFlipCard.jsx';
import { SevBadge, StatusBadge } from './opsShared.jsx';
import {
  backendNameForId,
  kindLabel,
  timelineEventHeadline,
  timelineEventSummary,
  timelineMetricTriplet,
} from '../lib/opsTimelineDisplay.js';

export function OpsTimelineEventCard({
  event,
  backends,
  flipped,
  onFlip,
  onDetails,
  selected,
}) {
  const headline = timelineEventHeadline(event, backends);
  const summary = timelineEventSummary(event);
  const backend = backendNameForId(event.backend_id, backends);
  const metrics = timelineMetricTriplet(event);
  const when = formatIST(event.at, false);

  const front = (
    <>
      <header className="eflip__head">
        <h4 className="eflip__title">{headline}</h4>
        <SevBadge severity={event.severity} />
      </header>
      <p className="eflip__backend">{backend}</p>
      {metrics ? (
        <dl className="eflip__metrics">
          <div><dt>Observed</dt><dd>{metrics.observed}</dd></div>
          <div><dt>Threshold</dt><dd>{metrics.threshold}</dd></div>
          <div><dt>{metrics.deltaLabel}</dt><dd>{metrics.delta}</dd></div>
        </dl>
      ) : summary ? (
        <p className="eflip__summary" title={summary}>{summary}</p>
      ) : null}
      <div className="eflip__meta-row">
        <time dateTime={event.at}>{when}</time>
        <span>{kindLabel(event.kind)}</span>
        {event.status ? <StatusBadge status={event.status} /> : null}
      </div>
    </>
  );

  const back = (
    <>
      <h4 className="eflip__title">Technical details</h4>
      <p className="eflip__tech">ID: {event.id}</p>
      {event.backend_id ? <p className="eflip__tech">Backend ID: {event.backend_id}</p> : null}
      {event.alert_type ? <p className="eflip__tech">Rule: {event.alert_type}</p> : null}
      {event.resource_id ? <p className="eflip__tech">Resource: {event.resource_id}</p> : null}
      {event.message ? <p className="eflip__summary" style={{ WebkitLineClamp: 6 }}>{event.message}</p> : null}
    </>
  );

  return (
    <EntityFlipCard
      className=""
      flipped={flipped}
      onFlip={onFlip}
      selected={selected}
      severity={event.severity}
      ariaLabel={`${headline}, ${backend}`}
      front={front}
      back={back}
      footer={(
        <button type="button" className="btn btn-primary btn--sm" onClick={onDetails}>
          Details
        </button>
      )}
    />
  );
}