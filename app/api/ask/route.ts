import { NextRequest, NextResponse } from 'next/server';

// Frontend proxy for the backend ask endpoint to avoid browser CORS
export async function POST(request: NextRequest) {
  try {
    const backendBaseUrl = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL;
    if (!backendBaseUrl) {
      return NextResponse.json({ error: 'Backend URL not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization') || undefined;
    const body = await request.json().catch(() => ({}));

    const base = backendBaseUrl.replace(/\/$/, '');
    const primaryUrl = `${base}/api/ask`;
    const fallbackUrl = `${base}/api/v1/ria/query`;

    let resp = await fetch(primaryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body || {}),
      cache: 'no-store',
    });

    // Fallback conditions: if /api/ask is not available or access is blocked (auth/payment),
    // try the generic v1 query endpoint to keep UX working.
    if ([404, 405, 401, 402].includes(resp.status)) {
      resp = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(body || {}),
        cache: 'no-store',
      });
    }

    const text = await resp.text();
    // Try to return JSON, otherwise pass through text
    try {
      const data = text ? JSON.parse(text) : null;
      return NextResponse.json(data, { status: resp.status });
    } catch {
      return new NextResponse(text, {
        status: resp.status,
        headers: { 'Content-Type': resp.headers.get('content-type') || 'text/plain' },
      });
    }
  } catch (error: any) {
    console.error('Proxy /api/ask error:', error);
    return NextResponse.json({ error: 'Ask proxy failed' }, { status: 500 });
  }
}
