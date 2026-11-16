import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import { UseCasesLayout } from '../../../(public)/use-cases/UseCasesLayout';

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <UseCasesLayout locale={locale}>{children}</UseCasesLayout>;
}
