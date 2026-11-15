import type { ReactNode } from 'react';
import { loadPublicResources, type PublicArea } from './catalogs';
import { I18nProvider } from './client';
import type { Locale } from './config';

/**
 * Gives a public layout's client components (nav, footer, install button)
 * their strings. Server-rendered at build time, like the rest of the page.
 */
export async function PublicI18nProvider({
  locale,
  areas,
  children,
}: {
  locale: Locale;
  areas: PublicArea[];
  children: ReactNode;
}) {
  const resources = await loadPublicResources(locale, areas);
  return (
    <I18nProvider locale={locale} resources={resources}>
      {children}
    </I18nProvider>
  );
}
