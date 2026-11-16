import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { PREFIXED_LOCALES } from '@/i18n/publicPages';
import { UseCaseArticle } from '../../../../(public)/use-cases/UseCaseArticle';
import {
  isUseCaseSlug,
  USE_CASE_SLUGS,
} from '../../../../(public)/use-cases/useCasesConfig';
import { useCasesMetadata } from '../../../../(public)/use-cases/useCasesMetadata';

type Props = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return PREFIXED_LOCALES.flatMap((locale) =>
    USE_CASE_SLUGS.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isUseCaseSlug(slug)) notFound();
  return useCasesMetadata(locale, slug);
}

export default async function LocalizedUseCasePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isUseCaseSlug(slug)) notFound();
  return <UseCaseArticle locale={locale} slug={slug} />;
}
