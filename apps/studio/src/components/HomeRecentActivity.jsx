import { Link } from 'react-router-dom';

function fmt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export default function HomeRecentActivity({ items }) {
  const list = items || [];
  if (!list.length) {
    return (
      <section className="qre-card">
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', marginTop: 0 }}>Recent activity</h2>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Run a simulation or submit a workload to see events here.</p>
      </section>
    );
  }
  return (
    <section className="qre-card">
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', marginTop: 0 }}>Recent activity</h2>
      <ul className="qre-activity-list">
        {list.map((ev) => (
          <li key={`${ev.kind}-${ev.id}`} className="qre-activity-list__item">
            <div>
              <span className={`qre-activity-pill qre-activity-pill--${ev.kind}`}>{ev.kind}</span>
              <Link to={`/project/${ev.project_id}`} style={{ fontWeight: 600, marginLeft: 8, color: 'var(--primary)' }}>
                {ev.project_name || ev.project_id?.slice(0, 8)}
              </Link>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
              {ev.status}
              {ev.shots != null ? ` · ${ev.shots} shots` : ''} · {fmt(ev.created_at)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
