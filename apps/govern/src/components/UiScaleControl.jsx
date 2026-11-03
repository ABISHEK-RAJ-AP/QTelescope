import { useEffect, useState } from 'react';
import { applyUiScale, cycleUiScale, readUiScale } from '../lib/uiScale.js';

export default function UiScaleControl() {
  const [scale, setScale] = useState(100);

  useEffect(() => {
    setScale(applyUiScale(readUiScale()));
  }, []);

  return (
    <button
      type="button"
      className="qre-topbar__kbd"
      title="Type size"
      aria-label={`Type size ${scale}%`}
      onClick={() => setScale(cycleUiScale(scale))}
    >
      A{scale === 90 ? '−' : scale === 110 ? '+' : ''}
    </button>
  );
}
