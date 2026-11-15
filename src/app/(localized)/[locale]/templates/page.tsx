import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { TemplatesPage } from '../../../(public)/templates/TemplatesPage';
import { templatesMetadata } from '../../../(public)/templates/templatesMetadata';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return templatesMetadata(locale);
}

export default async function LocalizedTemplatesPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <TemplatesPage locale={locale} />;
}
