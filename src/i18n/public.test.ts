import { describe, expect, it } from 'vitest';
import { loadPublicResources, type PublicArea } from './catalogs';
import {
  isTranslatedPath,
  localizedPath,
  PREFIXED_LOCALES,
  splitLocalePath,
  TRANSLATED_PUBLIC_PATHS,
} from './publicPages';
import { alternatesFor } from './seo';

const AREAS: PublicArea[] = [
  'site',
  'landing',
  'templates',
  'chromeExtension',
  'iosApp',
  'useCases',
  'docs',
];

// Flatten including arrays, so list lengths and each item are compared.
function flatten(
  value: unknown,
  prefix = '',
  out: Record<string, string> = {},
) {
  if (typeof value === 'string') out[prefix] = value;
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

const slots = (s: string) =>
  [...s.matchAll(/\{\{\s*[\w.]+\s*\}\}|<\/?\w+\s*\/?>/g)]
    .map((m) => m[0].replace(/\s+/g, ''))
    .sort()
    .join();

describe.each(PREFIXED_LOCALES)('public %s catalogs', (locale) => {
  for (const area of AREAS) {
    it(`${area}: same keys, list lengths and tags as English`, async () => {
      const res = await loadPublicResources(locale, [area]);
      const en = flatten(res.en.translation);
      const tr = flatten(res[locale].translation);
      expect(Object.keys(tr).sort()).toEqual(Object.keys(en).sort());
      const bad = Object.keys(en).filter((k) => slots(en[k]) !== slots(tr[k]));
      expect(bad).toEqual([]);
    });
  }

  it('does not ship marketing copy in the authenticated-app catalog', async () => {
    const { loadResources } = await import('./catalogs');
    const app = (await loadResources('en')).en.translation;
    for (const area of AREAS) expect(app).not.toHaveProperty(area);
  });
});

describe('public URLs', () => {
  it('leaves English unprefixed and prefixes translated pages only', () => {
    expect(localizedPath('en', '/templates')).toBe('/templates');
    expect(localizedPath('es', '/')).toBe('/es');
    expect(localizedPath('es', '/templates?category=Gifts')).toBe(
      '/es/templates?category=Gifts',
    );
    expect(localizedPath('es', '/#comparison')).toBe('/es#comparison');
    expect(localizedPath('es', '/docs/getting-started')).toBe(
      '/es/docs/getting-started',
    );
    // No Spanish privacy policy: link to the page that exists, not a 404.
    expect(localizedPath('es', '/privacy')).toBe('/privacy');
    expect(localizedPath('es', 'https://gobloom.io')).toBe(
      'https://gobloom.io',
    );
  });

  it('splits a locale prefix off a pathname', () => {
    expect(splitLocalePath('/es/templates')).toEqual({
      locale: 'es',
      path: '/templates',
    });
    expect(splitLocalePath('/es')).toEqual({ locale: 'es', path: '/' });
    expect(splitLocalePath('/de/docs/sharing')).toEqual({
      locale: 'de',
      path: '/docs/sharing',
    });
    expect(splitLocalePath('/templates')).toEqual({
      locale: 'en',
      path: '/templates',
    });
    expect(splitLocalePath('/en/x').locale).toBe('en');
  });

  it('emits reciprocal hreflang with x-default only for translated pages', () => {
    for (const path of TRANSLATED_PUBLIC_PATHS) {
      const en = alternatesFor('en', path);
      expect(en.languages?.['x-default']).toBe(localizedPath('en', path));
      expect(en.languages?.de).toBe(localizedPath('de', path));
      for (const locale of PREFIXED_LOCALES) {
        const alt = alternatesFor(locale, path);
        expect(alt.languages).toEqual(en.languages);
        expect(alt.canonical).toBe(localizedPath(locale, path));
      }
    }
    expect(isTranslatedPath('/privacy')).toBe(false);
    expect(alternatesFor('en', '/privacy')).toEqual({ canonical: '/privacy' });
  });
});
