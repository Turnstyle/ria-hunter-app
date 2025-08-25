import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.has('uid')) {
    res.cookies.set({
      name: 'uid',
      value: crypto.randomUUID(),
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      domain: '.ria-hunter.app',   // critical
      maxAge: 60 * 60 * 24 * 365,  // 1 year in seconds
    });
  }
  return res;
}

export const config = { matcher: ['/:path*'] };