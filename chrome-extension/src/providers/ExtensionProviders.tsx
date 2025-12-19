/**
 * Extension providers for Clerk authentication and Jazz data
 *
 * Uses @clerk/chrome-extension for auth with syncHost to share
 * session with the web app, and jazz-tools for local-first data.
 *
 * Important: Jazz is only initialized when the user is signed in,
 * since it requires an active Clerk session.
 */

import { ClerkProvider, SignedIn, useClerk } from "@clerk/chrome-extension";
import { JazzReactProviderWithClerk } from "jazz-tools/react";
import { JazzAccount } from "@tote/schema";
import { CLERK_PUBLISHABLE_KEY, JAZZ_API_KEY, SYNC_HOST } from "../config";

/**
 * Jazz provider - only rendered when user is signed in
 */
export function JazzProvider({ children }: { children: React.ReactNode }) {
  const clerk = useClerk();

  return (
    <JazzReactProviderWithClerk
      clerk={clerk}
      AccountSchema={JazzAccount}
      sync={{
        peer: `wss://cloud.jazz.tools/?key=${JAZZ_API_KEY}`,
      }}
    >
      {children}
    </JazzReactProviderWithClerk>
  );
}

/**
 * Clerk-only provider for the extension
 * Jazz is initialized separately only when signed in
 */
export function ExtensionProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      syncHost={SYNC_HOST}
      afterSignOutUrl={chrome.runtime.getURL("src/popup/popup.html")}
    >
      {children}
    </ClerkProvider>
  );
}
