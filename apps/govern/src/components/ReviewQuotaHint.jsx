export default function ReviewQuotaHint({ quota }) {
  if (!quota) return null;
  const blocked = quota.allowed === false;
  const requested = quota.requested_shots ?? 0;

  return (
    <div
      className="qre-card"
      style={blocked ? { borderLeft: '4px solid var(--danger)' } : { borderLeft: '4px solid var(--success)' }}
    >
      <div className="govern-section-head" style={{ marginBottom: 8 }}>
        <h3 className="govern-section-title" style={{ margin: 0 }}>
          Tenant simulation budget
        </h3>
        <span className={`govern-status ${blocked ? 'govern-status--bad' : 'govern-status--ok'}`}>
          {blocked ? 'Over quota' : 'Within quota'}
        </span>
      </div>
      <p className="govern-muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
        {quota.remaining_shots?.toLocaleString()} shots remaining of {quota.daily_shots_cap?.toLocaleString()} daily cap
        {requested > 0 && quota.shots_inferred && (
          <> · {requested.toLocaleString()} from latest project sim</>
        )}
        {requested > 0 && !quota.shots_inferred && <> · {requested.toLocaleString()} requested</>}
        {requested === 0 && !quota.shots_inferred && ' · no sim shot estimate for this package'}
      </p>
      {(quota.warnings || []).map((w) => (
        <p key={w} className="qre-alert" style={{ marginTop: 12, marginBottom: 0 }}>
          {w}
        </p>
      ))}
    </div>
  );
}
