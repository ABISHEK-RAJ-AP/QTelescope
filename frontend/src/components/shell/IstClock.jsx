import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { IST_TIMEZONE, LOCALE } from '../../utils/time';

const timeOnlyFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: IST_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: IST_TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** Isolated clock — cheap formatters; pauses when tab hidden. */
export function IstClock() {
  const [now, setNow] = useState(() => new Date());

  const label = useMemo(
    () => `${dateFmt.format(now)}, ${timeOnlyFmt.format(now)} IST`,
    [now],
  );

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(() => {
      if (!document.hidden) tick();
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="ist-clock">
      <span className="pulse-dot" />
      <Clock size={14} />
      <span>{label}</span>
    </div>
  );
}
