import React from 'react';
import { InfoTooltip } from './InfoTooltip.jsx';

/**
 * Severity-first exception metrics — shared by Fleet Overview and Operator Console.
 * Help icon sits outside the clickable control (no nested interactive elements).
 */
export function ExceptionStrip({ items, ariaLabel = 'Operational exceptions', className = '' }) {
  return (
    <div
      className={`dashboard-exceptions card ${className}`.trim()}
      role="region"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const body = (
          <>
            <span
              className={`dashboard-exception-stat__val${item.emphasis === 'critical' ? ' dashboard-exception-stat__val--critical' : ''}`}
            >
              {item.value}
            </span>
            <span className="dashboard-exception-stat__lbl">{item.label}</span>
          </>
        );

        return (
          <div key={item.id} className="dashboard-exception-stat-wrap">
            {item.onClick ? (
              <div
                role="button"
                tabIndex={0}
                className="dashboard-exception-stat"
                onClick={item.onClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    item.onClick();
                  }
                }}
                title={item.help}
              >
                {body}
              </div>
            ) : (
              <span className="dashboard-exception-stat dashboard-kpi-link--static" title={item.help}>
                {body}
              </span>
            )}
            {item.help ? (
              <span
                className="dashboard-exception-stat__help"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <InfoTooltip label={item.label}>
                  <p style={{ margin: 0, fontSize: 12, maxWidth: 280 }}>{item.help}</p>
                </InfoTooltip>
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
