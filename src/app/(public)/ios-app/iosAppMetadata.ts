import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { alternatesFor, ogLocale } from '@/i18n/seo';
import { getPublicT } from '@/i18n/server';

export async function iosAppMetadata(locale: Locale): Promise<Metadata> {
  const { t } = await getPublicT(locale, ['iosApp']);
  return {
    title: t('iosApp.meta.title'),
    description: t('iosApp.meta.description'),
    alternates: alternatesFor(locale, '/ios-app'),
    openGraph: {
      title: t('iosApp.meta.ogTitle'),
      description: t('iosApp.meta.ogDescription'),
      locale: ogLocale(locale),
    },
  };
}
