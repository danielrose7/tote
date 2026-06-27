import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { Providers } from '../providers';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <ErrorBoundary>{children}</ErrorBoundary>
    </Providers>
  );
}
