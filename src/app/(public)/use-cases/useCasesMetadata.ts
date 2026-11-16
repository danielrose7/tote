import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { alternatesFor, ogLocale } from '@/i18n/seo';
import { getPublicT } from '@/i18n/server';
import type { UseCaseSlug } from './useCasesConfig';

/** Metadata for `/use-cases` (slug omitted) or one use-case page. */
export async function useCasesMetadata(
  locale: Locale,
  slug?: UseCaseSlug,
): Promise<Metadata> {
  const { t } = await getPublicT(locale, ['useCases']);
  const base = slug ? `useCases.pages.${slug}.meta` : 'useCases.index.meta';
  return {
    title: t(`${base}.title`),
    description: t(`${base}.description`),
    alternates: alternatesFor(
      locale,
      slug ? `/use-cases/${slug}` : '/use-cases',
    ),
    openGraph: {
      title: t(`${base}.ogTitle`),
      description: t(`${base}.ogDescription`),
      locale: ogLocale(locale),
    },
  };
}
