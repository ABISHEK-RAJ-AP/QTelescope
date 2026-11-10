/**
 * FreshnessLabel
 * --------------
 * Shows data age in human-readable form with appropriate tone.
 *
 * Props:
 *   asOf         — ISO 8601 timestamp string | null
 *   staleMinutes — number of minutes before data is considered stale (default: 30)
 *   showIcon     — whether to render a Lucide icon beside the label (default: true)
 */

import { useMemo } from 'react';
import { Clock, AlertTriangle, HelpCircle } from 'lucide-react';

/** Format elapsed milliseconds into a terse human string. */
function formatAge(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s ago`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m ago`;
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) return `${totalHours}h ago`;
  const totalDays = Math.floor(totalHours / 24);
  return `${totalDays}d ago`;
}

export function FreshnessLabel({ asOf = null, staleMinutes = 30, showIcon = true }) {
  const { label, modifier, Icon, title } = useMemo(() => {
    if (!asOf) {
      return {
        label: 'No data',
        modifier: 'missing',
        Icon: HelpCircle,
        title: 'No timestamp available',
      };
    }

    const parsed = new Date(asOf);
    if (Number.isNaN(parsed.getTime())) {
      return {
        label: '—',
        modifier: 'missing',
        Icon: HelpCircle,
        title: 'Invalid timestamp',
      };
    }

    const ageMs = Date.now() - parsed.getTime();
    if (ageMs < 0) {
      // Future timestamp — treat as fresh
      return {
        label: 'Just now',
        modifier: 'ok',
        Icon: Clock,
        title: `Timestamp: ${parsed.toISOString()}`,
      };
    }

    const ageMinutes = ageMs / 60_000;
    const formatted = formatAge(ageMs);

    if (ageMinutes >= staleMinutes) {
      return {
        label: formatted,
        modifier: 'stale',
        Icon: AlertTriangle,
        title: `Data is stale — last updated ${parsed.toLocaleString()}`,
      };
    }

    return {
      label: formatted,
      modifier: 'ok',
      Icon: Clock,
      title: `Last updated ${parsed.toLocaleString()}`,
    };
  }, [asOf, staleMinutes]);

  return (
    <span
      className={`viz-freshness viz-freshness--${modifier}`}
      title={title}
      aria-label={title}
    >
      {showIcon && (
        <Icon
          size={11}
          aria-hidden="true"
          strokeWidth={2.2}
          style={{ flexShrink: 0 }}
        />
      )}
      {label}
    </span>
  );
}
