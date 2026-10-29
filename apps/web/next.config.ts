import path from 'node:path';
import type { NextConfig } from 'next';

// Read at `next build`: with `output: 'standalone'` the rewrites are baked into
// the routes manifest, so the Docker image takes this as a build arg.
const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  // Swagger UI only works at `/api/docs/` (its assets are relative), so the
  // slash must survive: no Next redirect dropping it, and a rewrite that keeps
  // it, since `:path*` would strip it and the API would redirect back forever.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/api/docs/', destination: `${apiUrl}/api/docs/` },
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
    ];
  },
};

export default nextConfig;
