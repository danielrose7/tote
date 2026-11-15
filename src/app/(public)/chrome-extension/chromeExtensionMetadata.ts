import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { alternatesFor, ogLocale } from '@/i18n/seo';
import { getPublicT } from '@/i18n/server';

export async function chromeExtensionMetadata(
  locale: Locale,
): Promise<Metadata> {
  const { t } = await getPublicT(locale, ['chromeExtension']);
  return {
    title: t('chromeExtension.meta.title'),
    description: t('chromeExtension.meta.description'),
    alternates: alternatesFor(locale, '/chrome-extension'),
    openGraph: {
      title: t('chromeExtension.meta.ogTitle'),
      description: t('chromeExtension.meta.ogDescription'),
      locale: ogLocale(locale),
    },
  };
}
