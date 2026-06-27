'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

const actionStyle: React.CSSProperties = {
  padding: '6px 16px',
  borderRadius: '6px',
  border: '1px solid currentColor',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '0.875rem',
  opacity: 0.7,
  fontFamily: 'inherit',
  color: 'inherit',
  textDecoration: 'none',
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            gap: '12px',
            fontFamily: 'inherit',
            color: 'inherit',
          }}
        >
          <p style={{ fontSize: '1rem', opacity: 0.7 }}>
            Something went wrong.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={this.reset} style={actionStyle}>
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={actionStyle}
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
