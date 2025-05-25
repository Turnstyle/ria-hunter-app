import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAxiom } from 'next-axiom';
import * as jose from 'jose';

// Environment variables for Auth0 - these should be set in your .env files
const AUTH0_ISSUER_BASE_URL = process.env.AUTH0_ISSUER_BASE_URL;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

// Create a JWKS client to fetch signing keys from Auth0
// Ensure AUTH0_ISSUER_BASE_URL is defined before creating the JWKSet
let jwksClient:
  | ReturnType<typeof jose.createRemoteJWKSet>
  | undefined = undefined;
if (AUTH0_ISSUER_BASE_URL) {
  try {
    jwksClient = jose.createRemoteJWKSet(
      new URL(`${AUTH0_ISSUER_BASE_URL}/.well-known/jwks.json`)
    );
  } catch (e) {
    console.error('Failed to create JWKS client for Auth0. Ensure AUTH0_ISSUER_BASE_URL is a valid URL.', e);
    // In a real scenario, you might want to prevent startup or have a clearer error handling strategy
  }
} else {
  console.warn('AUTH0_ISSUER_BASE_URL is not defined. Auth0 JWT validation will be skipped.');
}

// This function can be marked `async` if using `await` inside
async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const authHeader = requestHeaders.get('authorization');

  // Add correlation ID for request tracing
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();
  requestHeaders.set('x-correlation-id', correlationId);

  if (
    request.nextUrl.pathname.startsWith('/api/') &&
    !request.nextUrl.pathname.startsWith('/api/health') &&
    !request.nextUrl.pathname.startsWith('/api/public')
  ) {
    if (!jwksClient || !AUTH0_ISSUER_BASE_URL || !AUTH0_AUDIENCE) {
      console.error(
        'Auth0 configuration is incomplete. JWT validation cannot proceed. Check AUTH0_ISSUER_BASE_URL and AUTH0_AUDIENCE.'
      );
      return NextResponse.json(
        { error: 'Auth0 configuration error, unable to validate token' },
        { status: 500 }
      );
    }
    // AUTH0_ISSUER_BASE_URL and AUTH0_AUDIENCE are guaranteed to be strings here.

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    try {
      // Use non-null assertion operator as the variables are guaranteed to be defined and strings by the check above.
      const { payload, protectedHeader } = await jose.jwtVerify(token, jwksClient, {
        issuer: AUTH0_ISSUER_BASE_URL!,
        audience: AUTH0_AUDIENCE!,
      });

      console.log('Auth0 JWT validated successfully for user:', payload.sub);

    } catch (error: any) {
      console.error('Auth0 JWT validation failed:', error.message, error.code ? `(${error.code})` : '');
      let errorMessage = 'Invalid token';
      if (error.code === 'ERR_JWT_EXPIRED') {
        errorMessage = 'Token has expired';
      } else if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
        errorMessage = 'Token signature verification failed';
      } else if (error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
        errorMessage = `Token claim validation failed: ${error.message}`;
      }
      // Other error codes include ERR_JWKS_NO_MATCHING_KEY, ERR_JWK_INVALID, etc.

      return NextResponse.json(
        { error: errorMessage },
        { status: 401 } // Or 403 if authentication succeeded but authorization failed based on claims
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
