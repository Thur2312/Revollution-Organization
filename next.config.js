/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // cheerio (used by src/lib/inpi/cliente.ts, server-only) pulls in undici,
  // which uses syntax webpack's bundler chokes on. Keeping it external makes
  // the route handler `require()` it directly at runtime instead of bundling it.
  experimental: {
    serverComponentsExternalPackages: ['cheerio', 'undici'],
  },
};

module.exports = nextConfig;
