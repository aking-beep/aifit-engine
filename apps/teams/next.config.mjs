/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Next 16 blocks dev resources for other hosts; local tests and tools use 127.0.0.1.
  allowedDevOrigins: ['127.0.0.1'],
  // No database externals here, deliberately. This app does not depend on
  // @ark/db, and a config line implying otherwise is how that boundary starts
  // to blur. Control's next.config.mjs is where the libSQL externals live.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Reports and workspaces must not be framed by another site (clickjacking).
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Report links carry the intake; never send them to another origin as a Referer.
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
