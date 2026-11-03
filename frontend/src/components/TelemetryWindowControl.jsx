import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import {
  TELEMETRY_CUSTOM_SENTINEL,
  TELEMETRY_WINDOW_OPTIONS,
  clampTelemetryHours,
  readCustomTelemetryHours,
  readTelemetryWindowHours,
  selectValueForTelemetryHours,
  writeTelemetryWindowHours,
} from '../utils/telemetryWindow';

export function TelemetryWindowControl({ hours, onChange }) {
  const value = hours ?? readTelemetryWindowHours();
  const [customDraft, setCustomDraft] = useState(() => (
    selectValueForTelemetryHours(value) === TELEMETRY_CUSTOM_SENTINEL
      ? String(value)
      : String(readCustomTelemetryHours())
  ));

  const selectValue = selectValueForTelemetryHours(value);
  const customMode = selectValue === TELEMETRY_CUSTOM_SENTINEL;

  const applyCustom = () => {
    const h = clampTelemetryHours(customDraft);
    setCustomDraft(String(h));
    writeTelemetryWindowHours(h);
    onChange?.(h);
  };

  return (
    <div className="telemetry-window-control" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Clock size={16} color="var(--text-muted)" aria-hidden />
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Lookback</span>
      <select
        className="input-control"
        value={selectValue}
        aria-label="Telemetry lookback window"
        onChange={(e) => {
          const h = parseInt(e.target.value, 10);
          if (h === TELEMETRY_CUSTOM_SENTINEL) {
            const next = clampTelemetryHours(customDraft);
            setCustomDraft(String(next));
            writeTelemetryWindowHours(next);
            onChange?.(next);
            return;
          }
          writeTelemetryWindowHours(h);
          onChange?.(h);
        }}
      >
        {TELEMETRY_WINDOW_OPTIONS.map((o) => (
          <option key={o.hours} value={o.hours}>
            {o.label}
          </option>
        ))}
      </select>
      {customMode && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span className="sr-only">Custom lookback hours</span>
          <input
            type="number"
            className="input-control"
            style={{ minWidth: 88, width: 88, height: 32 }}
            min={1}
            max={720}
            value={customDraft}
            aria-label="Custom lookback hours (1–720)"
            onChange={(e) => setCustomDraft(e.target.value)}
            onBlur={applyCustom}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCustom(); } }}
          />
          <span style={{ color: 'var(--text-muted)' }}>hours</span>
        </label>
      )}
    </div>
  );
}
