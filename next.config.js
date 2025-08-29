const { withAxiom } = require('next-axiom');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Allow production builds to complete even with ESLint warnings
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    NEXT_PUBLIC_AXIOM_TOKEN: process.env.NEXT_PUBLIC_AXIOM_TOKEN,
    NEXT_PUBLIC_AXIOM_DATASET: process.env.NEXT_PUBLIC_AXIOM_DATASET || 'riahunter-prod',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  // Proxy API requests to the backend Vercel project
  // Backend has been consolidated to use standard /api/* paths only
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://ria-hunter.vercel.app/api/:path*',
      },
    ];
  },
  webpack: (config, { dev, isServer }) => {
    // Optimize webpack caching
    config.cache = {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
      cacheDirectory: path.resolve(__dirname, '.next/cache/webpack'),
      name: isServer ? 'server' : 'client',
      version: '1.0.0', // Change this if you need to invalidate the cache
      profile: false,
    };

    return config;
  },
};

// Wrap with Axiom
module.exports = withAxiom(nextConfig);