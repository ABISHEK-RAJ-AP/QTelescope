export default function SimHistogram({ counts }) {
  if (!counts || typeof counts !== 'object') {
    return <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0 }}>No measurement counts yet.</p>;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="qre-histogram">
      {entries.map(([bitstring, n]) => (
        <div key={bitstring} className="qre-histogram__row">
          <span className="qre-histogram__label">{bitstring}</span>
          <div className="qre-histogram__track">
            <div className="qre-histogram__fill" style={{ width: `${(n / max) * 100}%` }} title={`${n} shots`} />
          </div>
          <span className="qre-histogram__value">{n}</span>
        </div>
      ))}
    </div>
  );
}
