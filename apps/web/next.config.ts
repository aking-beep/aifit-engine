import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const api =
  process.env.API_ORIGIN ?? (process.env.VERCEL ? "" : "http://127.0.0.1:8472");

const nextConfig: NextConfig = {
  // The repository root has its own node_modules (the Teams npm workspace).
  // Pin Turbopack to this app so it resolves this app's dependencies.
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    if (!api) return [];
    return [
      { source: "/health", destination: `${api}/health` },
      { source: "/v1/:path*", destination: `${api}/v1/:path*` },
    ];
  },
};

export default nextConfig;
