import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

/** Public pages are indexable; accounts, workspaces, reports from links and APIs are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/workspace', '/report', '/invite', '/reset', '/account', '/billing'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
