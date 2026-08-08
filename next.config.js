/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/index.html',
      },
      {
        source: '/login',
        destination: '/index.html',
      },
      {
        source: '/dashboard',
        destination: '/index.html',
      },
    ];
  },
};

module.exports = nextConfig;
