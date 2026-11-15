import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { alternatesFor, ogLocale } from '@/i18n/seo';
import { getPublicT } from '@/i18n/server';

export async function landingMetadata(locale: Locale): Promise<Metadata> {
  const { t } = await getPublicT(locale, ['landing']);
  return {
    title: t('landing.meta.title'),
    description: t('landing.meta.description'),
    alternates: alternatesFor(locale, '/'),
    openGraph: {
      title: t('landing.meta.ogTitle'),
      description: t('landing.meta.ogDescription'),
      locale: ogLocale(locale),
    },
  };
}
