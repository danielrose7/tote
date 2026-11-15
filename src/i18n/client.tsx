'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import type { Resources } from './catalogs';
import type { RenderLocale } from './config';
import { createI18n } from './instance';

export { useTranslation } from 'react-i18next';

/**
 * Receives the already-loaded catalog from the server layout, so the first
 * client render matches the server HTML (no flash of English, no hydration
 * mismatch). Also keeps <html lang> honest — the root layout is static and
 * can't know the locale.
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

  useEffect(() => {
    document.documentElement.lang = locale === 'xx' ? 'en' : locale;
  }, [locale]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
