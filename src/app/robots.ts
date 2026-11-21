import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const privatePaths = ['/collections/', '/settings', '/invite/'];

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/docs/', '/use-cases/', '/privacy'],
        disallow: privatePaths,
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: ['/', '/docs/', '/use-cases/', '/privacy'],
        disallow: privatePaths,
      },
    ],
    sitemap: 'https://tote.tools/sitemap.xml',
  };
}
