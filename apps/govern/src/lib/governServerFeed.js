import { api } from '../api.js';
import { approvalsListPath, governanceSummaryPath } from './approvalsQuery.js';
import { readContextProjectId } from '@qre-theme/contextScope.js';
import {
  reconcileGovernServerNotices,
  removeGovernNotice,
  upsertGovernNotice,
} from './governNotices.js';

function can(permissions, perm) {
  return !permissions?.length || permissions.includes(perm);
}

function reviewHref(workloadId) {
  return `#/queue/${encodeURIComponent(workloadId)}`;
}

/**
 * Upsert server-driven notices (queue depth, pending approvals). Prunes stale server ids.
 */
export async function syncGovernServerNotices(permissions = []) {
  if (!can(permissions, 'approvals:read')) {
    reconcileGovernServerNotices([]);
    return;
  }

  const projectId = readContextProjectId() || '';
  const keep = new Set();

  try {
    const summary = await api(governanceSummaryPath(projectId));
    const queue = Number(summary.queue) || 0;
    const queueId = 'govern:server:queue';
    if (queue > 0) {
      keep.add(queueId);
      upsertGovernNotice({
        id: queueId,
        source: 'server',
        app: 'Govern',
        title: 'Review queue',
        body: `${queue} workload${queue === 1 ? '' : 's'} in the governance queue${projectId ? ` (project ${projectId})` : ''}.`,
        variant: queue >= 8 ? 'warn' : 'info',
        actions: [{ label: 'Open queue', href: '#/queue' }],
      });
    } else {
      removeGovernNotice(queueId);
    }
  } catch {
    /* offline or forbidden — leave existing server notices */
  }

  if (can(permissions, 'approvals:decide')) {
    try {
      const pending = await api(
        approvalsListPath({ state: 'submitted_for_review', projectId }),
      );
      const items = (pending.items || []).slice(0, 12);
      for (const row of items) {
        const wid = row.workload_id;
        if (!wid) continue;
        const id = `govern:server:approval:${wid}`;
        keep.add(id);
        const prog = row.governance_progress?.label || row.governance_state || 'Review';
        upsertGovernNotice({
          id,
          source: 'server',
          app: 'Govern',
          title: 'Approval requested',
          body: `${wid} · ${prog}${row.project_id ? ` · ${row.project_id}` : ''}`,
          variant: 'info',
          actions: [{ label: 'Review', href: reviewHref(wid) }],
        });
      }
    } catch {
      /* ignore */
    }
  }

  if (can(permissions, 'approvals:read')) {
    try {
      const inReview = await api(approvalsListPath({ state: 'in_review', projectId }));
      for (const row of (inReview.items || []).slice(0, 8)) {
        const wid = row.workload_id;
        if (!wid) continue;
        const id = `govern:server:in_review:${wid}`;
        keep.add(id);
        upsertGovernNotice({
          id,
          source: 'server',
          app: 'Govern',
          title: 'In review',
          body: `${wid} is in active review.`,
          variant: 'info',
          actions: [{ label: 'Open', href: reviewHref(wid) }],
        });
      }
    } catch {
      /* ignore */
    }
  }

  reconcileGovernServerNotices(keep);
}