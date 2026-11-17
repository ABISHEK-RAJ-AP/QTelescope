import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react';
import { subscribeToasts } from '../lib/toast.js';

const TTL = 6000;

const ICON = {
  ok: CheckCircle2,
  err: XCircle,
  warn: AlertTriangle,
};

export default function ToastHost() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    return subscribeToasts((item) => {
      setItems((prev) => [...prev.slice(-4), item]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== item.id));
      }, TTL);
    });
  }, []);

  if (!items.length) return null;

  return (
    <div className="qre-toast-stack" aria-live="polite" aria-relevant="additions">
      {items.map((item) => {
        const Icon = ICON[item.tone] || AlertTriangle;
        const live = item.tone === 'err' ? 'assertive' : 'polite';
        return (
          <div
            key={item.id}
            className={`qre-toast qre-toast--${item.tone}`}
            role={item.tone === 'err' ? 'alert' : 'status'}
            aria-live={live}
          >
            <span className="qre-toast__icon" aria-hidden>
              <Icon size={18} strokeWidth={2} />
            </span>
            <p className="qre-toast__message">{item.message}</p>
            <button
              type="button"
              className="qre-toast__close"
              aria-label="Dismiss notification"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}