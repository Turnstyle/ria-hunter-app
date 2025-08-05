// Temporarily disabled to fix webpack compilation issues
// export async function register() {
//   if (process.env.NEXT_RUNTIME === 'nodejs') {
//     const Sentry = await import('@sentry/nextjs');
//     Sentry.init({
//       dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
//       tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
//       debug: process.env.NODE_ENV === 'development',
//       environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
//     });
//   }
// }

// export function onRequestError({ request, response, error }) {
//   const Sentry = require('@sentry/nextjs');
//   Sentry.captureRequestError({ request, response, error });
// }