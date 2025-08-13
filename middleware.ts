import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  // Rewrite missing favicon.ico to an existing SVG to avoid 404s in logs
  if (req.nextUrl.pathname === '/favicon.ico') {
    const url = new URL('/og-image.svg', req.url)
    return NextResponse.rewrite(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}