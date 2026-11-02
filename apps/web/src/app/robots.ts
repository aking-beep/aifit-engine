import type { MetadataRoute } from "next";

const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://aifit-engine.vercel.app").replace(/\/+$/, "");

/** Public pages are indexable; accounts, personal results, shares and the API are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/v1/", "/app", "/results", "/share", "/history", "/reset", "/onboarding"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
