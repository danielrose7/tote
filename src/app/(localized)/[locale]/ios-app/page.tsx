import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { IosAppPage } from '../../../(public)/ios-app/IosAppPage';
import { iosAppMetadata } from '../../../(public)/ios-app/iosAppMetadata';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return iosAppMetadata(locale);
}

export default async function LocalizedIosAppPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <IosAppPage locale={locale} />;
}
