export default function InventoryCompatSummary({ result }) {
  if (!result) return null;
  const eligible = result.eligible === true;
  const reasons = result.reason_codes || [];

  return (
    <div className="govern-policy-dry-run">
      <div className="govern-policy-dry-run__head">
        <span className={`govern-status ${eligible ? 'govern-status--ok' : 'govern-status--bad'}`}>
          {eligible ? 'Eligible' : 'Not eligible'}
        </span>
        {result.asset_id && <span className="govern-muted" style={{ fontSize: 'var(--text-xs)' }}>{result.asset_id}</span>}
      </div>
      {reasons.length > 0 && (
        <ul className="govern-reason-list" style={{ marginTop: 12 }}>
          {reasons.map((code) => (
            <li key={code}>
              <code>{code}</code>
            </li>
          ))}
        </ul>
      )}
      {result.detail && <p className="govern-muted" style={{ marginTop: 12, marginBottom: 0 }}>{result.detail}</p>}
    </div>
  );
}
