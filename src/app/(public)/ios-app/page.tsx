import type { Metadata } from 'next';
import { IosAppPage } from './IosAppPage';
import { iosAppMetadata } from './iosAppMetadata';

export async function generateMetadata(): Promise<Metadata> {
  return iosAppMetadata('en');
}

export default function Page() {
  return <IosAppPage locale="en" />;
}
