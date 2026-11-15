'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type RenderLocale,
} from './config';

export function setLocaleCookie(locale: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API isn't available in every supported browser (Safari).
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Reconciles the cookie (what the server renders with) with the profile (the
 * source of truth across web, extension and iOS). Profile wins. A signed-in
 * user with no saved language gets one saved only if they explicitly chose it
 * (the cookie exists) — a language guessed from Accept-Language is not a
 * choice and shouldn't be pinned. Renders nothing.
 *
 * This is a background reconcile and the app stays usable in the cookie /
 * Accept-Language language if it fails, so failures are logged rather than
 * shown. An explicit change in Settings surfaces its own errors.
 */
export function LocaleSync({ locale }: { locale: RenderLocale }) {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !userId || syncedFor.current === userId) return;
    syncedFor.current = userId;
    // The pseudo-locale is a dev tool; never write it to a profile.
    if (locale === 'xx') return;

    let cancelled = false;
    (async () => {
      const res = await fetch('/api/v2/user/preferences');
      if (!res.ok) {
        console.warn('[i18n] could not load language preference', res.status);
        return;
      }
      if (cancelled) return;
      const { locale: saved } = (await res.json()) as { locale: string | null };
      if (isLocale(saved)) {
        if (saved !== locale) {
          setLocaleCookie(saved);
          router.refresh();
        }
      } else if (document.cookie.includes(`${LOCALE_COOKIE}=`)) {
        await fetch('/api/v2/user/preferences', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ locale }),
        });
      }
    })().catch((error) => {
      console.warn('[i18n] language preference sync failed', error);
    });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, userId, locale, router]);

  return null;
}
