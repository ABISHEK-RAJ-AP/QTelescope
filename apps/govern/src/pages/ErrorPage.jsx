import GovernPageShell from '../components/GovernPageShell.jsx';

const COPY = {
  notfound: {
    eyebrow: 'Govern',
    title: 'Page not found',
    subtitle: 'That route is not on the Govern surface.',
    body: 'Hash routes are the workspace map. Overview, queue, inventory, and the other nav items are the live set.',
    action: { label: 'Back to overview', route: '#/' },
  },
  forbidden: {
    eyebrow: 'Access',
    title: 'Permission required',
    subtitle: 'Your role cannot open this action.',
    body: 'Govern enforces RBAC on the API. Sign in with a role that has the permission, or ask a platform admin.',
    action: { label: 'Back to overview', route: '#/' },
  },
  crash: {
    eyebrow: 'Govern',
    title: 'This view failed',
    subtitle: 'The page hit an unexpected error. Data was not written.',
    body: 'Reload the page or return to overview. If it repeats, copy the detail below for the programme log.',
    action: { label: 'Back to overview', route: '#/' },
  },
  error: {
    eyebrow: 'Govern',
    title: 'Could not load this view',
    subtitle: 'The API returned an error for this page.',
    body: 'Retry after the server is reachable. Empty lists are not errors — only failed requests land here.',
    action: { label: 'Back to overview', route: '#/' },
  },
};

export default function ErrorPage({ kind = 'notfound', detail = '', path = '', onOpen, onRetry }) {
  const copy = COPY[kind] || COPY.error;
  return (
    <GovernPageShell eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} showContext={false}>
      <div className="qre-card govern-error-card">
        <span className="govern-empty__mark" aria-hidden />
        <p>{copy.body}</p>
        {path ? <p className="govern-mono govern-muted">{path}</p> : null}
        {detail ? <p className="govern-mono govern-muted">{detail}</p> : null}
        <div className="govern-empty__actions">
          {onRetry ? (
            <button type="button" className="qre-btn qre-btn--ghost" onClick={onRetry}>
              Retry
            </button>
          ) : null}
          <button type="button" className="qre-btn qre-btn--primary" onClick={() => onOpen?.(copy.action.route)}>
            {copy.action.label}
          </button>
        </div>
      </div>
    </GovernPageShell>
  );
}

export function errorKind(error) {
  const t = String(error || '').toLowerCase();
  if (/403|permission denied|forbidden/.test(t)) return 'forbidden';
  if (/404|not found/.test(t)) return 'notfound';
  return 'error';
}
