import { describe, expect, it } from 'vitest';
import { loadResources } from './catalogs';
import { isLocale, localeFromCookie, negotiateLocale } from './config';
import { createI18n } from './instance';
import { pseudoize, pseudoizeCatalog } from './pseudo';

describe('negotiateLocale', () => {
  it('returns null for empty or unsupported headers', () => {
    expect(negotiateLocale(null)).toBeNull();
    expect(negotiateLocale('')).toBeNull();
    expect(negotiateLocale('xx-YY,zz;q=0.5')).toBeNull();
    expect(negotiateLocale('*')).toBeNull();
  });

  it('matches on base language and ignores q=0', () => {
    expect(negotiateLocale('en-GB,en;q=0.9')).toBe('en');
    expect(negotiateLocale('xx;q=1, en;q=0.2')).toBe('en');
    expect(negotiateLocale('en;q=0')).toBeNull();
  });
});

describe('locale guards', () => {
  it('accepts supported locales and the pseudo-locale only from the cookie', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('xx')).toBe(false); // never a user-selectable language
    expect(localeFromCookie('xx')).toBe('xx');
    expect(localeFromCookie('en')).toBe('en');
    expect(localeFromCookie('fr')).toBeNull();
    expect(localeFromCookie(undefined)).toBeNull();
  });
});

describe('pseudoize', () => {
  it('accents, pads and brackets', () => {
    const out = pseudoize('Add Collection');
    expect(out.startsWith('[·')).toBe(true);
    expect(out.endsWith('·]')).toBe(true);
    expect(out).toContain('Ådd');
    expect(out.length).toBeGreaterThan('Add Collection'.length * 1.3);
  });

  it('leaves interpolation slots and nesting intact', () => {
    expect(pseudoize('Hello {{name}}, you have {{count}} items')).toContain(
      '{{name}}',
    );
    expect(pseudoize('Hello {{name}}')).toContain('{{name}}');
    expect(pseudoize('$t(common.retry) now')).toContain('$t(common.retry)');
  });

  it('maps nested catalogs', () => {
    const out = pseudoizeCatalog({ a: { b: 'Save' }, c: 'Open' });
    expect((out.a as { b: string }).b).toMatch(/^\[·+Såvé·+\]$/);
  });
});

describe('createI18n', () => {
  it('translates, interpolates and pluralizes with Intl.PluralRules', () => {
    const i18n = createI18n('en', {
      en: {
        translation: {
          items_one: '{{count}} item',
          items_other: '{{count}} items',
          hello: 'Hello {{name}}',
        },
      },
    });
    expect(i18n.t('items', { count: 1 })).toBe('1 item');
    expect(i18n.t('items', { count: 3 })).toBe('3 items');
    expect(i18n.t('hello', { name: '<b>Ana</b>' })).toBe('Hello <b>Ana</b>');
  });

  it('falls back to English when a key is missing in the active locale', async () => {
    const resources = await loadResources('xx');
    const i18n = createI18n('xx', {
      ...resources,
      en: { translation: { only_en: 'Only English' } },
    });
    expect(i18n.t('only_en')).toBe('Only English');
  });

  it('pseudo-locale renders every seeded string bracketed', async () => {
    const i18n = createI18n('xx', await loadResources('xx'));
    expect(i18n.t('common.retry')).toMatch(/^\[·+.+·+\]$/);
  });
});

import { formatPrice } from '@/lib/formatPrice';
import { formatCurrency, formatNumber, formatRelativeTime } from './format';

describe('formatters', () => {
  const now = Date.UTC(2026, 10, 14, 12, 0, 0);

  it('formats relative time in English, with "now" under a minute', () => {
    expect(formatRelativeTime(now - 5_000, 'en', now)).toBe('now');
    expect(formatRelativeTime(now - 5 * 60_000, 'en', now)).toBe(
      '5 minutes ago',
    );
    expect(formatRelativeTime(now - 26 * 3600_000, 'en', now)).toBe(
      'yesterday',
    );
    expect(formatRelativeTime(now + 2 * 3600_000, 'en', now)).toBe(
      'in 2 hours',
    );
  });

  it('formats numbers and currency with the locale conventions', () => {
    expect(formatNumber(1234567, 'en')).toBe('1,234,567');
    expect(formatNumber(1234567, 'de')).toBe('1.234.567');
    expect(formatCurrency(12.5, 'USD', 'en')).toBe('$12.50');
    expect(formatCurrency(12.5, 'USD', 'xx')).toBe('$12.50'); // pseudo = English
  });

  it('formatPrice keeps its en-US default and honours a locale', () => {
    expect(formatPrice('$29.99')).toBe('$29.99');
    expect(formatPrice('29,99', 'EUR')).toBe('€29.99');
    expect(formatPrice('€29,99', null, 'de')).toBe('29,99 €');
    expect(formatPrice('not a price')).toBe('not a price');
  });
});
