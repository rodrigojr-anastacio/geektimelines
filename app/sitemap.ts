import type { MetadataRoute } from 'next';
import { entries } from '@/lib/data';
import { SITE } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ['', '/about', '/sources', '/privacy', '/contact'].map((path) => ({
    url: `${SITE.url}${path}`,
    changeFrequency: 'monthly' as const,
    priority: path === '' ? 1 : 0.6,
  }));
  const entryPages = entries.map((entry) => ({
    url: `${SITE.url}/mcu/${entry.slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));
  return [...staticPages, ...entryPages];
}
