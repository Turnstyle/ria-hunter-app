import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAxiom } from 'next-axiom';

// This function can be marked `async` if using `await` inside
async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const authHeader = requestHeaders.get('authorization');

  // Add correlation ID for request tracing
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();
  requestHeaders.set('x-correlation-id', correlationId);

  // Basic API key validation for non-public routes
  if (request.nextUrl.pathname.startsWith('/api/') &&
      !request.nextUrl.pathname.startsWith('/api/health') &&
      !request.nextUrl.pathname.startsWith('/api/public')) {

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const apiKey = process.env.RIA_HUNTER_API_KEY;
    const providedKey = authHeader.split(' ')[1];

    if (!apiKey || providedKey !== apiKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }
  }

  // Clone the request headers and create a new response
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add security headers
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );

  return response;
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    '/api/:path*',
  ],
};

export default withAxiom(middleware);
