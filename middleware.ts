import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAxiom } from 'next-axiom';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// This function can be marked `async` if using `await` inside
async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const authHeader = requestHeaders.get('authorization');
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();
  requestHeaders.set('x-correlation-id', correlationId);

  // Hard skip middleware for public endpoints that must work without auth
  const publicApiPrefixes = [
    '/api/ask',
    '/api/health',
    '/api/public',
    '/api/browse-rias',
    '/api/ria-hunter/profile/',
    '/api/ria-hunter/fast-query',
    '/api/ria-hunter/search',
    '/api/debug-profile',
    '/api/subscription-status',
  ];
  const pathname = request.nextUrl.pathname;
  if (publicApiPrefixes.some((p) => pathname.startsWith(p))) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  if (
    pathname.startsWith('/api/')
  ) {
    // Check for Supabase configuration
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(
        'Supabase configuration is incomplete. JWT validation cannot proceed. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in environment variables.'
      );
      return NextResponse.json(
        { error: 'Supabase configuration error, unable to validate token' },
        { status: 500 }
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      console.error('Supabase token is missing after splitting header');
      return NextResponse.json(
        { error: 'Malformed authorization header' },
        { status: 401 }
      );
    }

    try {
      // Create Supabase client and validate the JWT token
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        console.error('Supabase JWT validation failed:', error?.message);
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }

      console.log('Supabase JWT validated successfully for user:', user.id, user.email);

    } catch (error: any) {
      console.error('Supabase JWT validation error:', error.message);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
  }

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
