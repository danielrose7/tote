import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from './config';

/**
 * Public (marketing) pages that exist in more than one language. Everything
 * else stays English at its unprefixed URL, and links from a translated page
 * to an untranslated one point there rather than at a 404. Add a path here
 * only together with its `[locale]` page — hreflang and the sitemap read it.
 */
export const TRANSLATED_PUBLIC_PATHS = [
  '/',
  '/templates',
  '/chrome-extension',
  '/ios-app',
] as const;

export function isTranslatedPath(path: string): boolean {
  return (TRANSLATED_PUBLIC_PATHS as readonly string[]).includes(path);
}

/** Locales other than the default, which live under a `/<locale>` prefix. */
export const PREFIXED_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

/** "/es/templates" → { locale: "es", path: "/templates" }; unprefixed → en. */
export function splitLocalePath(pathname: string): {
  locale: Locale;
  path: string;
} {
  const [, first, ...rest] = pathname.split('/');
  if (isLocale(first) && first !== DEFAULT_LOCALE) {
    return { locale: first, path: `/${rest.join('/')}` };
  }
  return { locale: DEFAULT_LOCALE, path: pathname || '/' };
}

/** The URL of `path` in `locale` (path may carry ?query / #hash). */
export function localizedPath(locale: string, href: string): string {
  if (!href.startsWith('/') || !isLocale(locale) || locale === DEFAULT_LOCALE) {
    return href;
  }
  const rest = href.search(/[?#]/);
  const path = rest === -1 ? href : href.slice(0, rest);
  const suffix = rest === -1 ? '' : href.slice(rest);
  if (!isTranslatedPath(path)) return href;
  return `/${locale}${path === '/' ? '' : path}${suffix}`;
}
