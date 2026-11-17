'use client';

import type { ClerkProvider } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export type ClerkLocalization = React.ComponentProps<
  typeof ClerkProvider
>['localization'];

/** Our locale → the @clerk/localizations export that matches its register. */
const CLERK_EXPORTS = { es: 'esMX', de: 'deDE' } as const;

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
    if (!Object.hasOwn(CLERK_EXPORTS, language)) return;
    const name = CLERK_EXPORTS[language as keyof typeof CLERK_EXPORTS];
    let cancelled = false;
    import('@clerk/localizations')
      .then((localizations) => {
        // Type-only skew: @clerk/localizations targets a newer @clerk/shared.
        if (!cancelled)
          setLocalization({
            language,
            value: localizations[name] as ClerkLocalization,
          });
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
