import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  // Locked down until the launch is approved; flip SITE.noindex to open it up.
  if (SITE.noindex) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
