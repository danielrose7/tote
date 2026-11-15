import { notFound } from 'next/navigation';
import { PublicClerkProvider } from '@/components/PublicClerkProvider';
import { isLocale, LOCALES } from '@/i18n/config';
import { PublicI18nProvider } from '@/i18n/PublicI18nProvider';
import { PREFIXED_LOCALES } from '@/i18n/publicPages';
import { RootShell } from '../../RootShell';
import { siteMetadata } from '../../siteMetadata';

export const metadata = siteMetadata;

// Only the languages we ship get a page; anything else under /<x> is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return PREFIXED_LOCALES.map((locale) => ({ locale }));
}

// Root layout for translated public pages (/es, /es/templates, …): its own
// <html lang> so the static HTML declares the right language.
export default async function LocalizedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale) || !LOCALES.includes(locale)) notFound();
  return (
    <RootShell lang={locale}>
      <PublicClerkProvider locale={locale}>
        <PublicI18nProvider locale={locale} areas={['site']}>
          {children}
        </PublicI18nProvider>
      </PublicClerkProvider>
    </RootShell>
  );
}
