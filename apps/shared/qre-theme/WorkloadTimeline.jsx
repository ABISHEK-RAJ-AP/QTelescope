function labelEventType(type) {
  if (!type) return 'Event';
  return type
    .split('.')
    .map((part) => part.replaceAll('_', ' '))
    .join(' · ');
}

const EVENT_LABELS = {
  'notify.delivered': 'Notification delivered',
  'notify.stub': 'Notification (stub queued)',
  'approval.entered': 'Entered review',
  'approval.approve': 'Approved',
  'approval.reject': 'Rejected',
  'approval.changes_requested': 'Changes requested',
  'submission.created': 'Submission created',
  'simulation.queued': 'Simulation queued',
  'simulation.started': 'Simulation started',
  'simulation.completed': 'Simulation completed',
  'simulation.failed': 'Simulation failed',
};

function labelForEvent(type) {
  if (EVENT_LABELS[type]) return EVENT_LABELS[type];
  return labelEventType(type);
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function matchFilter(ev, filter) {
  if (!filter || filter === 'all') return true;
  const sys = ev.source_system || '';
  const type = ev.event_type || '';
  if (filter === 'governance') {
    return sys === 'governance' || type.startsWith('approval.') || type.startsWith('notify.');
  }
  if (filter === 'development') {
    return sys === 'development' || type.startsWith('submission.') || type.startsWith('simulation.');
  }
  return true;
}

export default function WorkloadTimeline({
  timeline,
  emptyMessage = 'No timeline events yet.',
  filter = 'all',
  filterSlot = null,
}) {
  const events = (timeline?.events || []).filter((ev) => matchFilter(ev, filter));
  if (!events.length) {
    return (
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>{emptyMessage}</p>
    );
  }
  return (
    <>
      {filterSlot}
      <ol className="qre-timeline">
      {events.map((ev, idx) => (
        <li key={ev.event_id || idx} className="qre-timeline__item">
          <div className="qre-timeline__dot" aria-hidden />
          <div className="qre-timeline__body">
            <div className="qre-timeline__head">
              <span className="qre-timeline__type">{labelForEvent(ev.event_type)}</span>
              <span className="qre-timeline__meta">{ev.source_system}</span>
            </div>
            <time className="qre-timeline__time">{formatTime(ev.created_at)}</time>
            {ev.payload && Object.keys(ev.payload).length > 0 && (
              <pre className="qre-timeline__payload">{JSON.stringify(ev.payload, null, 2)}</pre>
            )}
          </div>
        </li>
      ))}
    </ol>
    </>
  );
}
