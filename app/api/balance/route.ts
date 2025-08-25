// app/api/balance/route.ts
// New consolidated balance endpoint that replaces credits/balance

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Re-export the handler from the existing balance endpoint
export async function GET(request: NextRequest) {
  try {
    // Forward to the existing handler with the same request
    const response = await fetch(new URL('/api/credits/balance', request.url), {
      method: 'GET',
      headers: request.headers,
      credentials: 'include',
    });

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
      { credits: null, isSubscriber: false, error: 'Failed to fetch credit balance' },
      { status: 500 }
    );
  }
}
