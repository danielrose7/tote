import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { UseCasesIndexPage } from '../../../(public)/use-cases/UseCasesIndexPage';
import { useCasesMetadata } from '../../../(public)/use-cases/useCasesMetadata';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return useCasesMetadata(locale);
}

export default async function LocalizedUseCasesPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <UseCasesIndexPage locale={locale} />;
}
