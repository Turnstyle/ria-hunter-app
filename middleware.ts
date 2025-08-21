import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export function middleware(req: NextRequest) {
  // Allow API routes to bypass middleware protection
  if (req.nextUrl.pathname.startsWith('/api/')) {
    // We don't block API routes here, authentication is handled within each API route
    return NextResponse.next()
  }
  
  // Rewrite missing favicon.ico to an existing SVG to avoid 404s in logs
  if (req.nextUrl.pathname === '/favicon.ico') {
    const url = new URL('/og-image.svg', req.url)
    return NextResponse.rewrite(url)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}