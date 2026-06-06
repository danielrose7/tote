/**
 * App providers — Clerk auth + Jazz local-first data
 *
 * Based on jazz-tools clerk-expo example:
 * https://github.com/garden-co/jazz/tree/main/examples/clerk-expo
 */

import { ClerkLoaded, ClerkProvider, useAuth, useClerk } from '@clerk/expo';
import { JazzAccount } from '@tote/schema';
import { JazzExpoProviderWithClerk } from 'jazz-tools/expo';
import { CLERK_PUBLISHABLE_KEY, JAZZ_API_KEY } from './config';
import { tokenCache } from './tokenCache';

function JazzProvider({ children }: { children: React.ReactNode }) {
  const clerk = useClerk();
  const { userId } = useAuth();

  return (
    <JazzExpoProviderWithClerk
      key={userId ?? 'unauthenticated'}
      clerk={clerk}
      AccountSchema={JazzAccount}
      sync={{
        peer: `wss://cloud.jazz.tools/?key=${JAZZ_API_KEY}`,
      }}
    >
      {children}
    </JazzExpoProviderWithClerk>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>
        <JazzProvider>{children}</JazzProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
