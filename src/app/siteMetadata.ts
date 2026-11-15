import type { Metadata } from 'next';
import { APP_STORE_ID } from '@/lib/constants';

/** Site-wide defaults. Each root layout re-exports this as its `metadata`. */
export const siteMetadata: Metadata = {
  title: {
    template: '%s — Tote',
    default: 'Tote — One place, every store',
  },
  description:
    'Save products from any online store in one place. Organize with collections, track prices, and share wishlists — all with complete privacy.',
  metadataBase: new URL('https://tote.tools'),
  manifest: '/site.webmanifest',
  itunes: { appId: APP_STORE_ID },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    siteName: 'Tote',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};
