import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { PREFIXED_LOCALES } from '@/i18n/publicPages';
import { DocsArticle } from '../../../../(public)/docs/DocsArticle';
import { DOC_SLUGS, isDocSlug } from '../../../../(public)/docs/docsConfig';
import { docsMetadata } from '../../../../(public)/docs/docsMetadata';

type Props = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return PREFIXED_LOCALES.flatMap((locale) =>
    DOC_SLUGS.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isDocSlug(slug)) notFound();
  return docsMetadata(locale, slug);
}

export default async function LocalizedDocPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isDocSlug(slug)) notFound();
  return <DocsArticle locale={locale} slug={slug} />;
}
