import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { loadResources } from './catalogs';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  localeFromCookie,
  negotiateLocale,
  type RenderLocale,
} from './config';
import { createI18n } from './instance';

/**
 * Locale for the current request: cookie (mirrors the user's profile, see
 * LocaleSync), then Accept-Language, then English. Reading cookies makes the
 * route dynamic — fine for the authenticated app, deliberately NOT used by
 * the static public pages (those take their locale from the URL).
 */
export const getLocale = cache(async (): Promise<RenderLocale> => {
  const fromCookie = localeFromCookie(
    (await cookies()).get(LOCALE_COOKIE)?.value,
  );
  if (fromCookie) return fromCookie;
  return (
    negotiateLocale((await headers()).get('accept-language')) ?? DEFAULT_LOCALE
  );
});

/** Server-side `t()`. In a client component use `useTranslation()` instead. */
export async function getT() {
  const locale = await getLocale();
  const i18n = createI18n(locale, await loadResources(locale));
  return { t: i18n.t.bind(i18n), locale, i18n };
}
