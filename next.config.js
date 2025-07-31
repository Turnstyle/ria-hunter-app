const { withAxiom } = require('next-axiom');
const { withSentryConfig } = require('@sentry/nextjs');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    NEXT_PUBLIC_AXIOM_TOKEN: process.env.NEXT_PUBLIC_AXIOM_TOKEN,
    NEXT_PUBLIC_AXIOM_DATASET: process.env.NEXT_PUBLIC_AXIOM_DATASET || 'riahunter-prod',
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

// First wrap with Axiom
const withAxiomConfig = withAxiom(nextConfig);

// Then wrap with Sentry
const sentryConfig = {
  silent: true,
  org: "stonewater-solutions",
  project: "riahunter",
  widenClientFileUpload: true,
  transpileClientSDK: true,
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
};

module.exports = withSentryConfig(withAxiomConfig, sentryConfig);
