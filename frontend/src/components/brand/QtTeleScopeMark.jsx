import React from 'react';
import './qt-brand.css';

/** Vector Q-TeleScope mark — no raster logo; uses theme tokens / .dark. */
export function QtTeleScopeMark({
  className = '',
  size = 32,
  title = 'Q-TeleScope',
  decorative = false,
}) {
  const s = Number(size) || 32;
  return (
    <svg
      className={`qt-brand-mark ${className}`.trim()}
      width={s}
      height={s}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
    >
      <title>{decorative ? undefined : title}</title>
      <rect className="qt-brand-mark__plate" width="32" height="32" rx="8" />
      <circle className="qt-brand-mark__ring" cx="14" cy="14" r="6" strokeWidth="2" />
      <path
        className="qt-brand-mark__tail"
        d="M18.6 18.6 24 24"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default QtTeleScopeMark;