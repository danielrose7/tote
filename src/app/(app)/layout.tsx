import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { loadResources } from '@/i18n/catalogs';
import { I18nProvider } from '@/i18n/client';
import { LocaleSync } from '@/i18n/LocaleSync';
import { getLocale } from '@/i18n/server';
import { Providers } from '../providers';
import { RootShell } from '../RootShell';
import { siteMetadata } from '../siteMetadata';

export const metadata = siteMetadata;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Cookie-based locale: the authenticated app is dynamic anyway and its URLs
  // are shared across mixed-language teams, so no locale prefix here.
  const locale = await getLocale();
  const resources = await loadResources(locale);
  return (
    <RootShell lang={locale === 'xx' ? 'en' : locale}>
      <I18nProvider key={locale} locale={locale} resources={resources}>
        <Providers>
          <LocaleSync locale={locale} />
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </I18nProvider>
    </RootShell>
  );
}
