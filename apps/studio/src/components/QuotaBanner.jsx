import { useEffect, useState } from 'react';
import { fetchStudioQuota } from '../api.js';

export default function QuotaBanner({ shots = 1024, blockLabel = false, onBlockedChange }) {
  const [quota, setQuota] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setErr('');
    fetchStudioQuota(shots)
      .then((q) => {
        setQuota(q);
        onBlockedChange?.(!q.allowed);
      })
      .catch((e) => setErr(String(e)));
    // ponytail: omit onBlockedChange from deps — parent setState is stable
  }, [shots]);

  if (err) return <p className="qre-alert">{err}</p>;
  if (!quota) return null;

  const blocked = !quota.allowed;

  return (
    <div className="qre-alert" style={blocked ? { borderColor: 'var(--danger)' } : undefined}>
      <strong>{blockLabel ? 'Simulation budget' : 'Tenant shot budget'}</strong>
      <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)' }}>
        {quota.remaining_shots?.toLocaleString()} remaining · {shots.toLocaleString()} requested —{' '}
        {blocked ? 'blocked' : 'OK'}
      </p>
      {(quota.warnings || []).map((w) => (
        <p key={w} style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--warning)' }}>
          {w}
        </p>
      ))}
    </div>
  );
}
