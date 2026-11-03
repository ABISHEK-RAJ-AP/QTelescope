/** Human-readable governance states (SRS snake_case stays in API). */
export const STATE_LABEL = {
  draft: 'Draft',
  submitted_for_review: 'Awaiting review',
  in_review: 'In review',
  pending_review: 'In review',
  changes_requested: 'Changes requested',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  approved: 'Approved',
};

export const DECISION_LABEL = {
  approve: 'Approved',
  changes_requested: 'Changes requested',
  reject: 'Rejected',
  withdraw: 'Withdrawn',
};

export function labelState(state) {
  return STATE_LABEL[state] || state?.replaceAll('_', ' ') || 'Unknown';
}

export function labelDecision(decision) {
  return DECISION_LABEL[decision] || labelState(decision);
}

export function labelTimelineEvent(type) {
  if (!type) return 'Event';
  return type
    .split('.')
    .map((part) => part.replaceAll('_', ' '))
    .join(' · ');
}
