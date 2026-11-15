import type { Metadata } from 'next';
import { TemplatesPage } from './TemplatesPage';
import { templatesMetadata } from './templatesMetadata';

export async function generateMetadata(): Promise<Metadata> {
  return templatesMetadata('en');
}

export default function Page() {
  return <TemplatesPage locale="en" />;
}
