import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { alternatesFor, ogLocale } from '@/i18n/seo';
import { getPublicT } from '@/i18n/server';

export async function templatesMetadata(locale: Locale): Promise<Metadata> {
  const { t } = await getPublicT(locale, ['templates']);
  return {
    // The root title template appends " — Tote".
    title: t('templates.meta.title'),
    description: t('templates.meta.description'),
    alternates: alternatesFor(locale, '/templates'),
    openGraph: {
      title: t('templates.meta.title'),
      description: t('templates.meta.description'),
      locale: ogLocale(locale),
    },
  };
}
