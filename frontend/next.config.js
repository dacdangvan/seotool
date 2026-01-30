/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Dashboard API has /api prefix in backend
      {
        source: '/api/dashboard/:path*',
        destination: 'http://localhost:3001/api/dashboard/:path*',
      },
      // Projects API has no /api prefix in backend
      {
        source: '/api/projects/:path*',
        destination: 'http://localhost:3001/projects/:path*',
      },
      {
        source: '/api/projects',
        destination: 'http://localhost:3001/projects',
      },
      // Default fallback for other API routes
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
