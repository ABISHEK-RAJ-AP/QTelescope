/**
 * Indian Standard Time (IST - UTC+05:30) Formatting Utilities
 */

export const IST_TIMEZONE = 'Asia/Kolkata';
export const LOCALE = 'en-IN';

export function parseDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;

  let str = String(dateInput).trim();
  // If string has no timezone indicator and no 'Z', append 'Z' so it's parsed as UTC
  if (!str.endsWith('Z') && !str.includes('+') && !str.includes('T')) {
    str = str.replace(' ', 'T') + 'Z';
  } else if (!str.endsWith('Z') && !str.includes('+') && str.includes('T')) {
    str = str + 'Z';
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date(dateInput) : d;
}

/**
 * Formats a date/timestamp to full IST date-time string.
 * Example: "10 Sep 2026, 06:23:45 PM IST"
 */
export function formatIST(dateInput, includeSeconds = true) {
  const d = parseDate(dateInput);
  if (!d) return 'N/A';

  const dateStr = d.toLocaleDateString(LOCALE, {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const timeStr = d.toLocaleTimeString(LOCALE, {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true
  });

  return `${dateStr}, ${timeStr} IST`;
}

/**
 * Formats a date/timestamp to IST time string only.
 * Example: "06:23:45 PM IST"
 */
export function formatISTTime(dateInput, includeSeconds = true) {
  const d = parseDate(dateInput);
  if (!d) return 'N/A';

  const timeStr = d.toLocaleTimeString(LOCALE, {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true
  });

  return `${timeStr} IST`;
}

/**
 * Formats a date/timestamp to IST date string only.
 * Example: "10 Sep 2026"
 */
export function formatISTDate(dateInput) {
  const d = parseDate(dateInput);
  if (!d) return 'N/A';

  return d.toLocaleDateString(LOCALE, {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Generates an array of time slot labels in IST ending with 'Live (IST)'.
 */
export function getISTChartSlots(hoursBack = 12, count = 6) {
  const slots = [];
  const now = new Date();
  const stepMs = (hoursBack * 3600 * 1000) / (count - 1);

  for (let i = count - 1; i > 0; i--) {
    const t = new Date(now.getTime() - i * stepMs);
    const timeStr = t.toLocaleTimeString(LOCALE, {
      timeZone: IST_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    slots.push(`${timeStr} IST`);
  }
  slots.push('Live (IST)');
  return slots;
}
