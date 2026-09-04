import type { NextConfig } from "next";

const api = process.env.API_ORIGIN ?? "http://127.0.0.1:8472";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/health", destination: `${api}/health` },
      { source: "/v1/:path*", destination: `${api}/v1/:path*` },
    ];
  },
};

export default nextConfig;
