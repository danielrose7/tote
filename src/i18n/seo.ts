import type { Metadata } from 'next';
import { DEFAULT_LOCALE, LOCALES, type Locale } from './config';
import { isTranslatedPath, localizedPath } from './publicPages';

/** BCP 47 / Open Graph tags for each UI locale. */
const OG_LOCALES: Record<Locale, string> = {
  en: 'en_US',
  es: 'es_419',
  de: 'de_DE',
};

/**
 * Canonical + hreflang for a public page. Every language version lists all the
 * versions that exist (itself included) plus `x-default` → English, so the set
 * is reciprocal as Google requires. Untranslated pages only get a canonical.
 * URLs are relative; the root `metadataBase` makes them absolute.
 */
export function alternatesFor(
  locale: Locale,
  path: string,
): NonNullable<Metadata['alternates']> {
  const canonical = localizedPath(locale, path);
  if (!isTranslatedPath(path.split(/[?#]/)[0])) return { canonical };
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = localizedPath(l, path);
  languages['x-default'] = localizedPath(DEFAULT_LOCALE, path);
  return { canonical, languages };
}

export function ogLocale(locale: Locale): string {
  return OG_LOCALES[locale];
}
