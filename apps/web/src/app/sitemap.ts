import type { MetadataRoute } from "next";
import { AUDIENCES } from "@/lib/audiences";

const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://aifit-engine.vercel.app").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/assessment", "/check", "/methodology", "/registry", "/privacy", "/terms", "/refunds", ...AUDIENCES.map((a) => `/for/${a.slug}`)];
  return pages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly", priority: p === "/" ? 1 : p.startsWith("/for/") ? 0.8 : 0.5 }));
}
