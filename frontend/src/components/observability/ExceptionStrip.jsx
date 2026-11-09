import React from 'react';
import { AnimatedNumber } from '../ui/AnimatedNumber.jsx';
import { InfoTooltip } from './InfoTooltip.jsx';

function StatValue({ value, tone }) {
  const n = Number(value);
  if (Number.isFinite(n)) {
    return (
      <span className={`dashboard-exception-stat__val dashboard-exception-stat__val--${tone}`}>
        <AnimatedNumber value={n} />
      </span>
    );
  }
  return <span className={`dashboard-exception-stat__val dashboard-exception-stat__val--${tone}`}>{value}</span>;
}

/**
 * Severity-first exception metrics — shared by Fleet Overview and Operator Console.
 * Supports tone (critical/warn/ok/neutral) + optional sub line (delta / context).
 */
export function ExceptionStrip({ items, ariaLabel = 'Operational exceptions', className = '', ...rest }) {
  return (
    <div
      className={`dashboard-exceptions card ${className}`.trim()}
      role="region"
      aria-label={ariaLabel}
      {...rest}
    >
      {items.map((item) => {
        const tone = item.tone || (item.emphasis === 'critical' ? 'critical' : 'neutral');
        const body = (
          <>
            <StatValue value={item.value} tone={tone} />
            <span className="dashboard-exception-stat__lbl">{item.label}</span>
            {item.sub ? <span className="dashboard-exception-stat__sub">{item.sub}</span> : null}
          </>
        );

        return (
          <div key={item.id} className={`dashboard-exception-stat-wrap dashboard-exception-stat-wrap--${tone}`}>
            {item.onClick ? (
              <div
                role="button"
                tabIndex={0}
                className={`dashboard-exception-stat dashboard-exception-stat--${tone}`}
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
              <span className={`dashboard-exception-stat dashboard-exception-stat--${tone} dashboard-kpi-link--static`} title={item.help}>
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
