/**
 * Locale-aware number, currency, date and relative-time formatting on top of
 * the platform's Intl APIs (no extra dependency). Never hand-format any of
 * these — decimal commas, digit grouping and word order all vary by locale.
 *
 * `locale` is the app's render locale; the pseudo-locale formats as English.
 */

export function intlLocale(locale: string): string {
  return locale === 'xx' ? 'en' : locale;
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

export function formatCurrency(
  amount: number,
  currency: string,
  locale: string,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency,
    ...options,
  }).format(amount);
}

type DateInput = Date | string | number;

export function formatDate(
  date: DateInput,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(
    new Date(date),
  );
}

export function formatDateTime(date: DateInput, locale: string): string {
  return formatDate(date, locale, { dateStyle: 'medium', timeStyle: 'short' });
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "5 minutes ago", "yesterday", "now" — in the given locale. */
export function formatRelativeTime(
  date: DateInput,
  locale: string,
  now: number = Date.now(),
): string {
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), {
    numeric: 'auto',
  });
  const seconds = Math.round((new Date(date).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  for (const [unit, size] of UNITS) {
    if (abs >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  // Under a minute: "now" reads better than "in 12 seconds ago" churn.
  return rtf.format(0, 'second');
}
