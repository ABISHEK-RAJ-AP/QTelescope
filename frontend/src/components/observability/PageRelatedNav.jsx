import React from 'react';

const linkBtnStyle = {
  background: 'none',
  border: 0,
  cursor: 'pointer',
  padding: 0,
};

/** Footer / modal related destinations — text links, not secondary buttons. */
export function PageRelatedNav({ children, className = '', 'aria-label': ariaLabel = 'Related pages' }) {
  return (
    <nav className={`link-row page-related-nav ${className}`.trim()} aria-label={ariaLabel}>
      {children}
    </nav>
  );
}

export function PageRelatedLink({ children, onClick, type = 'button' }) {
  return (
    <button type={type} className="fs-link" style={linkBtnStyle} onClick={onClick}>
      {children}
    </button>
  );
}
