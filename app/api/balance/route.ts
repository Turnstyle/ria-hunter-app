// app/api/balance/route.ts
// This endpoint is handled by the backend through the proxy
// This file exists only to prevent 404s during the transition
// The Next.js rewrite in next.config.js will handle forwarding to the backend

import { NextResponse } from 'next/server';

export async function GET() {
  // This should never be reached because the rewrite handles it
  // But if it is, return an error to indicate misconfiguration
  return NextResponse.json(
    { error: 'This endpoint should be handled by the backend proxy' },
    { status: 500 }
  );
}
