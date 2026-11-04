/** Observed job record statuses — monitoring only, not circuit submission. */

export const JOB_STATUS_HELP = {
  COMPLETED: 'Collector recorded a finished run with no failure flag.',
  RUNNING: 'In-flight per last snapshot — may lag vendor truth.',
  QUEUED: 'Waiting in backend queue telemetry, not submitted from this UI.',
  FAILED: 'Terminal failure or vendor error text classified as failed.',
  ERROR: 'Same bucket as FAILED in filters.',
  CANCELLED: 'Cancelled or aborted; counted in error KPIs.',
};

export function jobStatusTooltip(status) {
  return JOB_STATUS_HELP[status] || 'Status from stored job records in platform DB.';
}
