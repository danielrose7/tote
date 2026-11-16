import { describe, expect, it } from 'vitest';
import { loadPublicResources, type PublicArea } from './catalogs';
import {
  isTranslatedPath,
  localizedPath,
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

describe('public Spanish catalogs', () => {
  for (const area of AREAS) {
    it(`${area}: same keys, list lengths and tags as English`, async () => {
      const res = await loadPublicResources('es', [area]);
      const en = flatten(res.en.translation);
      const es = flatten(res.es.translation);
      expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
      const bad = Object.keys(en).filter((k) => slots(en[k]) !== slots(es[k]));
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
    expect(splitLocalePath('/templates')).toEqual({
      locale: 'en',
      path: '/templates',
    });
    expect(splitLocalePath('/en/x').locale).toBe('en');
  });

  it('emits reciprocal hreflang with x-default only for translated pages', () => {
    for (const path of TRANSLATED_PUBLIC_PATHS) {
      const en = alternatesFor('en', path);
      const es = alternatesFor('es', path);
      expect(en.languages).toEqual(es.languages);
      expect(en.languages?.['x-default']).toBe(localizedPath('en', path));
      expect(es.canonical).toBe(localizedPath('es', path));
    }
    expect(isTranslatedPath('/privacy')).toBe(false);
    expect(alternatesFor('en', '/privacy')).toEqual({ canonical: '/privacy' });
  });
});
