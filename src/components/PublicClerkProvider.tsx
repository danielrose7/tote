'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { useClerkLocalization } from './useClerkLocalization';

/** ClerkProvider for the statically generated public pages. */
export function PublicClerkProvider({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider localization={useClerkLocalization(locale)}>
      {children}
    </ClerkProvider>
  );
}
