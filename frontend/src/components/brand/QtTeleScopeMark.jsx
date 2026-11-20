import React from 'react';
import './qt-brand.css';

/** Transparent lockup — same asset on light and dark; dark mode uses glow filter. */
const LOCKUP_TRANSPARENT = '/brand/q-telescope-lockup-dark.png';

/**
 * Official Q-TeleScope lockup. No badge/plate wrapper.
 * `size` sets logo height in px. `theme`: auto (CSS), light, or dark.
 */
export function QtTeleScopeMark({
  className = '',
  size = 32,
  height,
  title = 'Q-TeleScope',
  decorative = false,
  theme = 'auto',
}) {
  const h = Number(height ?? size) || 32;
  const alt = decorative ? '' : title;
  const imgClass = [
    'qt-brand-lockup__img',
    theme === 'dark' ? 'qt-brand-lockup__img--glow' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (theme === 'light' || theme === 'dark') {
    return (
      <img
        className={imgClass}
        src={LOCKUP_TRANSPARENT}
        alt={alt}
        aria-hidden={decorative || undefined}
        height={h}
        style={{ height: h, width: 'auto' }}
        decoding="async"
      />
    );
  }

  return (
    <span
      className={`qt-brand-lockup ${className}`.trim()}
      style={{ '--qt-logo-h': `${h}px` }}
      role={decorative ? 'presentation' : undefined}
    >
      <img
        className="qt-brand-lockup__img qt-brand-lockup__img--light"
        src={LOCKUP_TRANSPARENT}
        alt={alt}
        aria-hidden={decorative || undefined}
        height={h}
        decoding="async"
      />
      <img
        className="qt-brand-lockup__img qt-brand-lockup__img--dark qt-brand-lockup__img--glow"
        src={LOCKUP_TRANSPARENT}
        alt={decorative ? undefined : alt}
        aria-hidden={decorative ? true : undefined}
        height={h}
        decoding="async"
      />
    </span>
  );
}

export default QtTeleScopeMark;