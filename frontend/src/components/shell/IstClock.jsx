import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatIST } from '../../utils/time';

/** Isolated 1s clock — updates only this subtree, not the full app shell. */
export function IstClock() {
  const [istTime, setIstTime] = useState(() => formatIST(new Date()));

  useEffect(() => {
    const timer = setInterval(() => setIstTime(formatIST(new Date())), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="ist-clock">
      <span className="pulse-dot" />
      <Clock size={14} />
      <span>{istTime}</span>
    </div>
  );
}
