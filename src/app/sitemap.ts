import type { MetadataRoute } from 'next';
import { LOCALES } from '@/i18n/config';
import { localizedPath, TRANSLATED_PUBLIC_PATHS } from '@/i18n/publicPages';
import { getAllPublishedCollectionSlugs } from '../lib/publishedCollectionsDb';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://tote.tools';

  // One entry per language version of each translated page, each listing all
  // versions (itself included) plus x-default → English, as Google requires.
  const translatedRoutes: MetadataRoute.Sitemap =
    TRANSLATED_PUBLIC_PATHS.flatMap((path) => {
      const languages: Record<string, string> = {};
      for (const l of LOCALES) languages[l] = baseUrl + localizedPath(l, path);
      languages['x-default'] = languages.en;
      return LOCALES.map((l) => ({
        url: baseUrl + localizedPath(l, path),
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: path === '/' ? (l === 'en' ? 1 : 0.9) : 0.8,
        alternates: { languages },
      }));
    });

  const staticRoutes: MetadataRoute.Sitemap = [
    ...translatedRoutes,
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/docs/getting-started`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/docs/collections`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/slots`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/adding-links`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/extension`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/chrome-extension`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/docs/ios-app`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/ios-app`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/docs/selections-and-budgets`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/sharing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/templates`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/use-cases`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/use-cases/gift-shopping`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/use-cases/home-renovation`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/use-cases/personal-style`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/use-cases/family-shopping`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/use-cases/professional-projects`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];

  const collections = await getAllPublishedCollectionSlugs().catch(() => []);
  const collectionRoutes: MetadataRoute.Sitemap = collections.map((c) => ({
    url: `${baseUrl}/s/${c.username}/${c.slug}`,
    lastModified: c.updatedAt,
    priority: 0.7,
  }));

  return [...staticRoutes, ...collectionRoutes];
}
