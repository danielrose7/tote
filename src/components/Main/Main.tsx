'use client';

import type { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';

interface MainProps {
  children: ReactNode;
  className?: string;
  fallbackMessage?: string;
}

const refreshStyle: React.CSSProperties = {
  marginTop: '8px',
  padding: '6px 16px',
  borderRadius: '6px',
  border: '1px solid currentColor',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '0.875rem',
  opacity: 0.7,
  fontFamily: 'inherit',
  color: 'inherit',
};

export function Main({ children, className, fallbackMessage }: MainProps) {
  const fallback = (
    <main className={className}>
      <div
        style={{
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '4px',
        }}
      >
        <p style={{ opacity: 0.6, margin: 0 }}>
          {fallbackMessage ?? 'Something went wrong. Please refresh the page.'}
        </p>
        <button
          type="button"
          style={refreshStyle}
          onClick={() => window.location.reload()}
        >
          Refresh page
        </button>
      </div>
    </main>
  );

  return (
    <ErrorBoundary fallback={fallback}>
      <main className={className}>{children}</main>
    </ErrorBoundary>
  );
}
