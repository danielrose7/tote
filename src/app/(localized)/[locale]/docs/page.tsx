import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { DocsIndexPage } from '../../../(public)/docs/DocsIndexPage';
import { docsMetadata } from '../../../(public)/docs/docsMetadata';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return docsMetadata(locale);
}

export default async function LocalizedDocsPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <DocsIndexPage locale={locale} />;
}
