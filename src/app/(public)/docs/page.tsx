import type { Metadata } from 'next';
import { DocsIndexPage } from './DocsIndexPage';
import { docsMetadata } from './docsMetadata';

export async function generateMetadata(): Promise<Metadata> {
  return docsMetadata('en');
}

export default function Page() {
  return <DocsIndexPage locale="en" />;
}
