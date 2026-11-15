import type { Metadata } from 'next';
import { LandingPage } from './LandingPage';
import { landingMetadata } from './landingMetadata';

export async function generateMetadata(): Promise<Metadata> {
  return landingMetadata('en');
}

export default function HomePage() {
  return <LandingPage locale="en" />;
}
