'use client';

import type { ClerkProvider } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export type ClerkLocalization = React.ComponentProps<
  typeof ClerkProvider
>['localization'];

/**
 * Clerk's own UI (sign-in, profile) ships its own translations. Load only the
 * active language's file, and only when it isn't English, so English users pay
 * nothing. Until it arrives Clerk renders in English.
 */
export function useClerkLocalization(language: string): ClerkLocalization {
  const [localization, setLocalization] = useState<{
    language: string;
    value: ClerkLocalization;
  } | null>(null);
  useEffect(() => {
    if (language !== 'es') return;
    let cancelled = false;
    import('@clerk/localizations')
      .then(({ esMX }) => {
        // Type-only skew: @clerk/localizations targets a newer @clerk/shared.
        if (!cancelled)
          setLocalization({ language, value: esMX as ClerkLocalization });
      })
      .catch((error: unknown) => {
        console.error('Could not load Clerk translations', error);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);
  return localization?.language === language ? localization.value : undefined;
}
