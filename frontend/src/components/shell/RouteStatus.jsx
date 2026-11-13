import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, SearchX, ShieldAlert } from 'lucide-react';
import { COPY } from '../../copy/operator.js';

export function RouteStatus({ icon: Icon, title, message, actions, role = 'status', page = false }) {
  return (
    <div className={page ? 'route-status route-status--page' : 'route-status'} role={role}>
      <Icon size={28} aria-hidden />
      <h1>{title}</h1>
      <p>{message}</p>
      {actions ? <div className="route-status__actions">{actions}</div> : null}
    </div>
  );
}

export function NotFoundPage({ variant = 'public' }) {
  const console = variant === 'console';
  return (
    <RouteStatus
      page={!console}
      icon={SearchX}
      title={COPY.shell.notFoundTitle}
      message={COPY.shell.notFoundBody}
      actions={(
        <>
          <Link className="btn btn-primary" to={console ? '/app/overview' : '/'}>
            {console ? 'Open overview' : 'Go to home'}
          </Link>
          {console ? null : <Link className="btn btn-secondary" to="/login">Sign in</Link>}
        </>
      )}
    />
  );
}

export function AccessDenied({ role }) {
  return (
    <RouteStatus
      role="alert"
      icon={ShieldAlert}
      title={COPY.shell.deniedTitle}
      message={COPY.shell.deniedBody.replace('{role}', role || 'This role')}
    />
  );
}

export class ConsoleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const raw = String(error?.message || '');
    const safe = raw && raw.length < 140 && !/chunk|undefined is not|cannot read/i.test(raw)
      ? raw
      : COPY.shell.crashBody;
    return (
      <RouteStatus
        page={this.props.page}
        role="alert"
        icon={AlertTriangle}
        title={COPY.shell.crashTitle}
        message={safe}
        actions={(
          <>
            <button type="button" className="btn btn-primary" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <Link className="btn btn-secondary" to="/app/overview">Open overview</Link>
          </>
        )}
      />
    );
  }
}
