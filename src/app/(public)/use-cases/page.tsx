import type { Metadata } from 'next';
import { UseCasesIndexPage } from './UseCasesIndexPage';
import { useCasesMetadata } from './useCasesMetadata';

export async function generateMetadata(): Promise<Metadata> {
  return useCasesMetadata('en');
}

export default function Page() {
  return <UseCasesIndexPage locale="en" />;
}
