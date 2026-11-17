/**
 * Locale configuration. Pure and dependency-free so it can be imported from
 * the proxy, server components, client components and tests alike.
 *
 * Adding a language: add it to LOCALES + LOCALE_LABELS, add
 * `src/i18n/locales/<id>/common.json`, and register it in `catalogs.ts`.
 * See docs/LOCALIZATION.md.
 */

/** Languages a user can pick. English is the source language. */
export const LOCALES = ['en', 'es', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Hidden pseudo-locale for layout and coverage testing: strings are accented
 * and padded ~40% (see pseudo.ts). Never shown in the picker, but honoured if
 * set — `document.cookie = 'tote-locale=xx'`. Unwrapped strings stay plain
 * English and stand out; clipped layouts show a missing closing bracket.
 */
export const PSEUDO_LOCALE = 'xx';

/** Locale actually used to render: a real one, or the pseudo-locale. */
export type RenderLocale = Locale | typeof PSEUDO_LOCALE;

/** Each language names itself, so a user can find theirs in any UI language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
};

export const LOCALE_COOKIE = 'tote-locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
  );
}

export function isRenderLocale(value: unknown): value is RenderLocale {
  return value === PSEUDO_LOCALE || isLocale(value);
}

/**
 * First supported language in an Accept-Language header, honouring order and
 * ignoring q-values beyond ordering. Matches on the base language ("es-MX" →
 * "es"). Returns null if nothing matches.
 */
export function negotiateLocale(
  acceptLanguage: string | null | undefined,
): Locale | null {
  if (!acceptLanguage) return null;
  const ranked = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return {
        tag: tag.toLowerCase(),
        weight: Number.isNaN(weight) ? 0 : weight,
        index,
      };
    })
    .filter((entry) => entry.tag && entry.tag !== '*' && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const { tag } of ranked) {
    const base = tag.split('-')[0];
    const match = LOCALES.find((locale) => locale === tag || locale === base);
    if (match) return match;
  }
  return null;
}

/** Cookie value → locale to render with, else null (caller falls back). */
export function localeFromCookie(
  value: string | undefined,
): RenderLocale | null {
  return isRenderLocale(value) ? value : null;
}
