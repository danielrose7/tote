import { describe, expect, it } from 'vitest';
import { loadResources } from './catalogs';
import { negotiateLocale } from './config';
import { createI18n } from './instance';
import type { Catalog } from './pseudo';

function flatten(obj: Catalog, prefix = '', out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else flatten(v as Catalog, key, out);
  }
  return out;
}

const slots = (s: string) =>
  [...s.matchAll(/\{\{\s*[\w.]+\s*\}\}|<\/?\w+\s*\/?>/g)]
    .map((m) => m[0].replace(/\s+/g, ''))
    .sort();

describe('Spanish catalog', () => {
  it('is negotiated from Accept-Language, including regional tags', () => {
    expect(negotiateLocale('es-MX,es;q=0.9,en;q=0.5')).toBe('es');
    expect(negotiateLocale('fr,es;q=0.4')).toBe('es');
  });

  it('keeps every interpolation slot and tag from the English source', async () => {
    const res = await loadResources('es');
    const en = flatten(res.en.translation);
    const es = flatten(res.es.translation);
    const problems: string[] = [];
    for (const [key, value] of Object.entries(es)) {
      // Plural variants are keyed `_one`/`_other`; compare against the same
      // suffix in English, falling back to the `_other` form.
      const source = en[key] ?? en[key.replace(/_(one|many)$/, '_other')];
      if (source === undefined) {
        problems.push(`${key}: no English source`);
      } else if (slots(source).join() !== slots(value).join()) {
        problems.push(`${key}: ${slots(source)} vs ${slots(value)}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('translates every English key', async () => {
    const res = await loadResources('es');
    const en = Object.keys(flatten(res.en.translation));
    const es = flatten(res.es.translation);
    expect(en.filter((k) => !(k in es))).toEqual([]);
  });

  it('pluralizes in Spanish and falls back to English for missing keys', async () => {
    const res = await loadResources('es');
    const i18n = createI18n('es', res);
    expect(i18n.t('slots.section.itemCount', { count: 1 })).toBe('1 artículo');
    expect(i18n.t('slots.section.itemCount', { count: 3 })).toBe('3 artículos');
    expect(i18n.t('no.such.key')).toBe('no.such.key');
  });
});
