'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from '@/i18n/client';

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

function DefaultFallback({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation();
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
        {t('shell.errorBoundary.message')}
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={onReset} style={actionStyle}>
          {t('shell.errorBoundary.tryAgain')}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={actionStyle}
        >
          {t('shell.refreshPage')}
        </button>
      </div>
    </div>
  );
}

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
      return <DefaultFallback onReset={this.reset} />;
    }

    return this.props.children;
  }
}
