import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { ChromeExtensionPage } from '../../../(public)/chrome-extension/ChromeExtensionPage';
import { chromeExtensionMetadata } from '../../../(public)/chrome-extension/chromeExtensionMetadata';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return chromeExtensionMetadata(locale);
}

export default async function LocalizedChromeExtensionPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ChromeExtensionPage locale={locale} />;
}
