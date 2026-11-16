import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { DocsLayout } from '../../../(public)/docs/DocsLayout';

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <DocsLayout locale={locale}>{children}</DocsLayout>;
}
