import React from 'react';
import { TelemetryWindowControl } from '../TelemetryWindowControl.jsx';
import { InfoTooltip } from './InfoTooltip.jsx';

/**
 * Standard lookback control. Set affectsQuery=false when the page does not pass hours to APIs.
 */
export function TimeRangeSelector({ hours, onChange, affectsQuery = true }) {
  return (
    <div className="time-range-selector">
      <TelemetryWindowControl hours={hours} onChange={onChange} />
      {!affectsQuery && (
        <InfoTooltip label="Time range scope">
          <p style={{ margin: 0, fontSize: 12 }}>
            Lookback is stored for telemetry pages that use it. This view may not refetch when you change it.
          </p>
        </InfoTooltip>
      )}
      {affectsQuery && (
        <span className="time-range-selector__hint">Filters stored samples on this page</span>
      )}
    </div>
  );
}
