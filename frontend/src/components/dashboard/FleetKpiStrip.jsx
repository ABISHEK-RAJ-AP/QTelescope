import React from 'react';
import { Link } from 'react-router-dom';
import { AnimatedNumber } from '../ui/AnimatedNumber.jsx';

function Delta({ value }) {
  if (value == null || value === 0) return null;
  const up = value > 0;
  return (
    <span className={`fo-kpi-delta fo-kpi-delta--${up ? 'up' : 'down'}`} aria-label={`${up ? 'Increased' : 'Decreased'} by ${Math.abs(value)}`}>
      {up ? '+' : ''}{value}
    </span>
  );
}

export function FleetKpiStrip({ items = [], showDelta = false, className = '' }) {
  if (!items.length) return null;
  return (
    <section className={`fo-kpi-strip ${className}`.trim()} aria-label="Fleet summary" data-tour="page-fleet-kpis">
      <div className="fo-kpi-strip__inner">
        {items.map((k) => {
          const meta = [k.scope, k.hint].filter(Boolean).join(' · ');
          return (
            <Link
              key={k.id}
              to={k.to || '#'}
              className={`fo-kpi-tile${k.tone ? ` fo-kpi-tile--${k.tone}` : ''}`}
              onClick={k.onClick}
            >
              <span className="fo-kpi-tile__label">{k.label}</span>
              <div className="fo-kpi-tile__value-line">
                <span className="fo-kpi-tile__value">
                  <AnimatedNumber value={k.value} />
                  {k.suffix ? <span className="fo-kpi-tile__suffix">{k.suffix}</span> : null}
                </span>
                {showDelta ? <Delta value={k.delta} /> : null}
              </div>
              {meta ? <p className="fo-kpi-tile__meta">{meta}</p> : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
