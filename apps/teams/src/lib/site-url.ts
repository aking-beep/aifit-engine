/** The public origin for canonical links, the sitemap and share cards. */
export function siteUrl(): string {
  const env = process.env;
  const raw = env.NEXT_PUBLIC_SITE_URL || env.APP_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3001');
  return raw.replace(/\/+$/, '');
}
