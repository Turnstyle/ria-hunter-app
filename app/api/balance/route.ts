// app/api/balance/route.ts
// Simple proxy for the backend balance endpoint
// Required because the client still expects this endpoint

// Force Node.js runtime for fetch operations (fixes Edge runtime limitations)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Forward the request to the /api/credits/balance endpoint through the proxy
  const response = await fetch('https://ria-hunter.vercel.app/api/credits/balance', {
    method: 'GET',
    headers: request.headers,
  });

  try {
    // Get the response data
    const data = await response.json();

    // Return the same response
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error) {
    console.error('Error in balance endpoint:', error);
    return NextResponse.json(
      { credits: 15, balance: 15, isSubscriber: false, source: 'guest-default' },
      { status: 200 }
    );
  }
}