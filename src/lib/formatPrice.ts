import { intlLocale } from '@/i18n/format';

export { normalizeCurrency, pagePriceProperties } from './currency';

const SYMBOL_TO_CURRENCY: [string, string][] = [
  ['A$', 'AUD'],
  ['C$', 'CAD'],
  ['HK$', 'HKD'],
  ['NZ$', 'NZD'],
  ['S$', 'SGD'],
  ['$', 'USD'],
  ['£', 'GBP'],
  ['€', 'EUR'],
  ['¥', 'JPY'],
  ['₹', 'INR'],
  ['₩', 'KRW'],
  ['₣', 'CHF'],
];

/**
 * Formats a scraped price string for display. Parsing is locale-independent
 * (the input comes from a store, not from the UI language); `locale` only
 * controls how the result is written. Defaults to en-US so callers that don't
 * pass one keep today's output.
 */
export function formatPrice(
  raw: string,
  currencyCode?: string | null,
  locale = 'en-US',
): string {
  const trimmed = raw.trim();

  let currency = currencyCode?.toUpperCase() ?? 'USD';
  let digits = trimmed;

  for (const [symbol, code] of SYMBOL_TO_CURRENCY) {
    if (trimmed.startsWith(symbol)) {
      currency = code;
      digits = trimmed.slice(symbol.length).trim();
      break;
    }
  }

  // Handle European comma-decimal format (e.g. "29,99") vs thousands separators
  // If there's a comma but no period, treat comma as decimal separator
  const hasComma = digits.includes(',');
  const hasPeriod = digits.includes('.');
  if (hasComma && !hasPeriod) {
    digits = digits.replace(',', '.');
  } else {
    digits = digits.replace(/,/g, '');
  }

  const value = parseFloat(digits);
  if (Number.isNaN(value)) return raw;

  try {
    return new Intl.NumberFormat(intlLocale(locale), {
      style: 'currency',
      currency,
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return raw;
  }
}
