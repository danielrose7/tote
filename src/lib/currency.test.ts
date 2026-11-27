import { describe, expect, it } from 'vitest';
import { normalizeCurrency, pagePriceProperties } from './currency';
import { formatPrice } from './formatPrice';

describe('normalizeCurrency', () => {
  it('accepts ISO 4217 codes in any case', () => {
    expect(normalizeCurrency('eur')).toBe('EUR');
    expect(normalizeCurrency(' GBP ')).toBe('GBP');
  });

  it('rejects symbols, names and non-strings', () => {
    expect(normalizeCurrency('€')).toBeUndefined();
    expect(normalizeCurrency('Euro')).toBeUndefined();
    expect(normalizeCurrency(978)).toBeUndefined();
    expect(normalizeCurrency(undefined)).toBeUndefined();
  });
});

describe('pagePriceProperties', () => {
  it('saves the currency with the price', () => {
    expect(pagePriceProperties({ price: '49.99', currency: 'eur' })).toEqual({
      price: '49.99',
      currency: 'EUR',
    });
  });

  it('clears a stale currency when the new price has none', () => {
    const saved = { price: '10', currency: 'EUR' };
    const next = { ...saved, ...pagePriceProperties({ price: '12' }) };
    expect(JSON.parse(JSON.stringify(next))).toEqual({ price: '12' });
  });

  it('changes nothing without a price', () => {
    expect(pagePriceProperties({ currency: 'EUR' })).toEqual({});
  });
});

describe('formatPrice with a saved currency', () => {
  it('no longer shows a euro price as dollars', () => {
    expect(formatPrice('49.99', 'EUR')).toBe('€49.99');
    expect(formatPrice('49.99')).toBe('$49.99');
  });
});
