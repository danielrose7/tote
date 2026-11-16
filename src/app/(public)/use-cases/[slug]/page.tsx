import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UseCaseArticle } from '../UseCaseArticle';
import { isUseCaseSlug, USE_CASE_SLUGS } from '../useCasesConfig';
import { useCasesMetadata } from '../useCasesMetadata';

type Props = { params: Promise<{ slug: string }> };

// Only the five use-case slugs exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return USE_CASE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isUseCaseSlug(slug)) notFound();
  return useCasesMetadata('en', slug);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!isUseCaseSlug(slug)) notFound();
  return <UseCaseArticle locale="en" slug={slug} />;
}
