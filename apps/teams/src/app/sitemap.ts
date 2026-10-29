import type { MetadataRoute } from 'next';
import { AUDIENCES } from '@/lib/audiences';
import { siteUrl } from '@/lib/site-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages = ['/', '/assess', '/methodology', '/privacy', '/terms', '/refunds', ...AUDIENCES.map((a) => `/for/${a.slug}`)];
  return pages.map((p) => ({ url: `${base}${p}`, changeFrequency: 'weekly', priority: p === '/' ? 1 : p.startsWith('/for/') ? 0.8 : 0.5 }));
}
