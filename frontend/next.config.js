/** @type {import('next').NextConfig} */
const internalApi = process.env.INTERNAL_API_URL || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${internalApi}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
