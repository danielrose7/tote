import { ClerkProvider } from '@clerk/chrome-extension';
import { CLERK_PUBLISHABLE_KEY, SYNC_HOST } from '../config';

export function ExtensionProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      syncHost={SYNC_HOST}
      afterSignOutUrl={chrome.runtime.getURL('src/popup/popup.html')}
    >
      {children}
    </ClerkProvider>
  );
}
