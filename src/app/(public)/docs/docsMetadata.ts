import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { alternatesFor, ogLocale } from '@/i18n/seo';
import { getPublicT } from '@/i18n/server';
import type { DocSlug } from './docsConfig';

/** Metadata for `/docs` (slug omitted) or one docs page. */
export async function docsMetadata(
  locale: Locale,
  slug?: DocSlug,
): Promise<Metadata> {
  const { t } = await getPublicT(locale, ['docs']);
  const base = slug ? `docs.pages.${slug}.meta` : 'docs.index.meta';
  return {
    title: t(`${base}.title`),
    description: t(`${base}.description`),
    alternates: alternatesFor(locale, slug ? `/docs/${slug}` : '/docs'),
    openGraph: {
      title: t(`${base}.ogTitle`),
      description: t(`${base}.ogDescription`),
      locale: ogLocale(locale),
    },
  };
}
