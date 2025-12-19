"use client";

import { ClerkProvider, useClerk } from "@clerk/nextjs";
import { JazzReactProviderWithClerk } from "jazz-tools/react";
import { JazzAccount } from "../src/schema";
import { ToastProvider } from "../src/components/ToastNotification";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { JazzInspector } from "jazz-tools/inspector";
import { apiKey } from "../src/apiKey";

function JazzProvider({ children }: { children: React.ReactNode }) {
  const clerk = useClerk();

  return (
    <JazzReactProviderWithClerk
      clerk={clerk}
      AccountSchema={JazzAccount}
      sync={{
        peer: `wss://cloud.jazz.tools/?key=${apiKey}`,
      }}
    >
      <ToastProvider>
        <OfflineBanner />
        {children}
        <JazzInspector />
      </ToastProvider>
    </JazzReactProviderWithClerk>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <JazzProvider>{children}</JazzProvider>
    </ClerkProvider>
  );
}
