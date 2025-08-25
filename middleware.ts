import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.has('uid')) {
    res.cookies.set({
      name: 'uid',
      value: crypto.randomUUID(),          // web crypto is available in middleware
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,          // 1 year
    });
  }
  return res;
}

export const config = { matcher: ['/:path*'] }; // run for all routes (incl. /_backend)