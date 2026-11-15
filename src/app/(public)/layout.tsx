import { PublicClerkProvider } from '@/components/PublicClerkProvider';
import { PublicI18nProvider } from '@/i18n/PublicI18nProvider';
import { RootShell } from '../RootShell';
import { siteMetadata } from '../siteMetadata';

export const metadata = siteMetadata;

// Root layout for the English public pages (unprefixed URLs). The translated
// pages live under /[locale] and have their own root layout.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RootShell lang="en">
      <PublicClerkProvider locale="en">
        <PublicI18nProvider locale="en" areas={['site']}>
          {children}
        </PublicI18nProvider>
      </PublicClerkProvider>
    </RootShell>
  );
}
