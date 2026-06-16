import type { NextConfig } from 'next';

const config: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: 'http://localhost:3001/:path*',
      },
    ];
  },
};

export default config;
