import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsArticle } from '../DocsArticle';
import { DOC_SLUGS, isDocSlug } from '../docsConfig';
import { docsMetadata } from '../docsMetadata';

type Props = { params: Promise<{ slug: string }> };

// Only the listed guides exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isDocSlug(slug)) notFound();
  return docsMetadata('en', slug);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!isDocSlug(slug)) notFound();
  return <DocsArticle locale="en" slug={slug} />;
}
