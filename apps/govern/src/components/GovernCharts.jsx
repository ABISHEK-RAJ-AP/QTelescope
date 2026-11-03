/** Lightweight SVG charts — no extra dependency. */

export function SparkBars({ values = [], color = 'var(--primary)', height = 88 }) {
  const max = Math.max(...values, 1);
  const gap = 6;
  const barW = values.length ? (100 - gap * (values.length - 1)) / values.length : 100;
  return (
    <svg viewBox={`0 0 100 ${height}`} className="govern-chart" role="img" aria-label="Queue trend">
      {values.map((v, i) => {
        const h = (v / max) * (height - 12);
        return (
          <rect
            key={`${i}-${v}`}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            rx="2"
            fill={color}
            opacity={0.35 + (i / Math.max(values.length, 1)) * 0.65}
          />
        );
      })}
    </svg>
  );
}

export function DonutMix({ slices = [], size = 140 }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="govern-donut">
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label="Admission mix">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="14" />
        {slices.map((slice) => {
          const len = (slice.value / total) * c;
          const dash = `${len} ${c - len}`;
          const rot = (acc / total) * 360 - 90;
          acc += slice.value;
          return (
            <circle
              key={slice.label}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth="14"
              strokeDasharray={dash}
              transform={`rotate(${rot} 60 60)`}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <ul className="govern-donut__legend">
        {slices.map((slice) => (
          <li key={slice.label}>
            <span className="govern-donut__swatch" style={{ background: slice.color }} />
            {slice.label}
            <strong>{slice.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function mixFromCounts(counts = {}) {
  const slices = [
    { label: 'Submitted', value: counts.submitted_for_review ?? 0, color: 'var(--primary)' },
    { label: 'In review', value: counts.in_review ?? 0, color: 'var(--warning)' },
    { label: 'Changes', value: counts.changes_requested ?? 0, color: 'var(--accent)' },
    { label: 'Approved', value: counts.approved ?? 0, color: 'var(--success)' },
  ];
  const live = slices.some((s) => s.value > 0);
  return { slices, preview: !live };
}
