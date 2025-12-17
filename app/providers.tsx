"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { JazzReactProvider } from "jazz-tools/react";
import { JazzAccount } from "../src/schema";
import { ToastProvider } from "../src/components/ToastNotification";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { JazzInspector } from "jazz-tools/inspector";
import { apiKey } from "../src/apiKey";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <JazzReactProvider
        AccountSchema={JazzAccount}
        enableSSR
        sync={{
          peer: `wss://cloud.jazz.tools/?key=${apiKey}`,
        }}
      >
        <ToastProvider>
          <OfflineBanner />
          {children}
          <JazzInspector />
        </ToastProvider>
      </JazzReactProvider>
    </ClerkProvider>
  );
}
