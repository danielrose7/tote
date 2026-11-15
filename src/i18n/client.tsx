'use client';

import { type ReactNode, useMemo, useState } from 'react';
import { I18nextProvider, Trans, useTranslation } from 'react-i18next';
import { formatPrice } from '@/lib/formatPrice';
import type { Resources } from './catalogs';
import type { RenderLocale } from './config';

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
} from './format';
import { createI18n } from './instance';

export { Trans, useTranslation };

/** Formatters bound to the current locale. Use these, never hand-format. */
export function useFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  return useMemo(
    () => ({
      locale,
      number: (value: number) => formatNumber(value, locale),
      currency: (
        amount: number,
        currency: string,
        options?: Intl.NumberFormatOptions,
      ) => formatCurrency(amount, currency, locale, options),
      price: (raw: string, currencyCode?: string | null) =>
        formatPrice(raw, currencyCode, locale),
      date: (
        value: Date | string | number,
        options?: Intl.DateTimeFormatOptions,
      ) => formatDate(value, locale, options),
      dateTime: (value: Date | string | number) =>
        formatDateTime(value, locale),
      relativeTime: (value: Date | string | number) =>
        formatRelativeTime(value, locale),
    }),
    [locale],
  );
}

/**
 * Receives the already-loaded catalog from the server layout, so the first
 * client render matches the server HTML (no flash of English, no hydration
 * mismatch). <html lang> is set by each root layout (see app/RootShell).
 */
export function I18nProvider({
  locale,
  resources,
  children,
}: {
  locale: RenderLocale;
  resources: Resources;
  children: ReactNode;
}) {
  const [i18n] = useState(() => createI18n(locale, resources));

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
