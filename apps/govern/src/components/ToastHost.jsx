import { useEffect, useState } from 'react';
import { subscribeToasts } from '../lib/toast.js';

const TTL = 5000;

export default function ToastHost() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    return subscribeToasts((item) => {
      setItems((prev) => [...prev.slice(-3), item]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== item.id));
      }, TTL);
    });
  }, []);

  if (!items.length) return null;
  return (
    <div className="govern-toasts" aria-live="polite" aria-relevant="additions">
      {items.map((item) => (
        <p key={item.id} className={`govern-toast govern-toast--${item.tone}`} role="status">
          {item.message}
          <button
            type="button"
            className="govern-toast__close"
            aria-label="Dismiss"
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
          >
            ×
          </button>
        </p>
      ))}
    </div>
  );
}
