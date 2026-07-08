import type {MetadataRoute} from 'next';
import {existsSync, readdirSync, statSync} from 'fs';
import path from 'path';
import {fixedRoutes} from '@/config/navigation';

const articlesPerPage = 6;
const noindexRoutes = new Set(['/achievements']);

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://slantdaily.com').replace(/\/$/, '');
}

function getGuideEntries(siteUrl: string): MetadataRoute.Sitemap {
  const guidesDirectory = path.join(process.cwd(), 'content', 'en', 'guides');

  if (!existsSync(guidesDirectory)) {
    return [];
  }

  const guideFiles = readdirSync(guidesDirectory)
    .filter((file) => file.endsWith('.mdx'))
    .sort();
  const guidePages = Math.max(1, Math.ceil(guideFiles.length / articlesPerPage));
  const paginationEntries = Array.from({length: Math.max(0, guidePages - 1)}, (_, index) => {
    const pageNumber = index + 2;

    return {
      url: `${siteUrl}/guides?page=${pageNumber}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5
    };
  });
  const articleEntries = guideFiles.map((file) => {
    const filePath = path.join(guidesDirectory, file);
    const slug = file.replace(/\.mdx$/, '');

    return {
      url: `${siteUrl}/guides/${slug}`,
      lastModified: statSync(filePath).mtime,
      changeFrequency: 'monthly' as const,
      priority: 0.7
    };
  });

  return [...paginationEntries, ...articleEntries];
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const routeSettings: Record<string, Pick<MetadataRoute.Sitemap[number], 'changeFrequency' | 'priority'>> = {
    '/': {changeFrequency: 'daily', priority: 1},
    '/archive': {changeFrequency: 'daily', priority: 0.8},
    '/achievements': {changeFrequency: 'weekly', priority: 0.6},
    '/printable-slant': {changeFrequency: 'daily', priority: 0.8},
    '/guides': {changeFrequency: 'weekly', priority: 0.8},
    '/privacy-policy': {changeFrequency: 'yearly', priority: 0.3},
    '/terms-of-service': {changeFrequency: 'yearly', priority: 0.3},
    '/copyright': {changeFrequency: 'yearly', priority: 0.2},
    '/about': {changeFrequency: 'yearly', priority: 0.4},
    '/contact': {changeFrequency: 'yearly', priority: 0.3}
  };

  const fixedEntries = fixedRoutes
    .filter((route) => !noindexRoutes.has(route))
    .map((route) => ({
      url: `${siteUrl}${route === '/' ? '' : route}`,
      lastModified: new Date(),
      ...routeSettings[route]
    }));

  return [...fixedEntries, ...getGuideEntries(siteUrl)];
}
