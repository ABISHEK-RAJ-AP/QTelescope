import { Component } from 'react';
import ErrorPage from '../pages/ErrorPage.jsx';

export default class GovernErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  render() {
    if (this.state.err) {
      return (
        <ErrorPage
          kind="crash"
          detail={this.state.err.message || String(this.state.err)}
          onOpen={this.props.onOpen}
          onRetry={() => {
            this.setState({ err: null });
            window.location.reload();
          }}
        />
      );
    }
    return this.props.children;
  }
}
