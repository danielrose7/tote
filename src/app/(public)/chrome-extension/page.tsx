import type { Metadata } from 'next';
import { ChromeExtensionPage } from './ChromeExtensionPage';
import { chromeExtensionMetadata } from './chromeExtensionMetadata';

export async function generateMetadata(): Promise<Metadata> {
  return chromeExtensionMetadata('en');
}

export default function Page() {
  return <ChromeExtensionPage locale="en" />;
}
