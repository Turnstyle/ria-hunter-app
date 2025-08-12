import { NextRequest, NextResponse } from 'next/server';

// Proxy subscription status to the backend service so the frontend stays in sync
// with the single source of truth for usage and subscription info.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const backendBaseUrl = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL;
    if (!backendBaseUrl) {
      return NextResponse.json({ error: 'Backend URL not configured' }, { status: 500 });
    }

    const url = `${backendBaseUrl.replace(/\/$/, '')}/api/subscription-status`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
      },
      // Ensure server-side fetch doesn't cache stale results
      cache: 'no-store',
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      const status = resp.status || 500;
      return NextResponse.json(
        data || { error: 'Failed to fetch subscription status' },
        { status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return NextResponse.json({ error: 'Failed to check subscription status' }, { status: 500 });
  }
}
