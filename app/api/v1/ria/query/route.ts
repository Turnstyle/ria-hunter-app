import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers as nextHeaders } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const reqHeaders = await nextHeaders();
    const incomingReqId = reqHeaders?.get?.('x-request-id') || undefined;
    const requestId = incomingReqId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const backendBaseUrl = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL;
    if (!backendBaseUrl) {
      return NextResponse.json({ error: 'Backend URL not configured' }, { status: 500 });
    }

    let authHeader = request.headers.get('authorization') || undefined;
    const body = await request.json().catch(() => ({}));

    if (!authHeader) {
      try {
        const cookieStore = await cookies();
        const directToken = (cookieStore as any)?.get?.('sb-access-token')?.value;
        if (directToken) {
          authHeader = `Bearer ${directToken}`;
        } else {
          const all = ((cookieStore as any)?.getAll?.() ?? []) as Array<{ name: string; value: string }>;
          const sbCookie = all.find(c => c.name.includes('sb-') && c.name.includes('auth')) || all.find(c => c.name.startsWith('sb-'));
          if (sbCookie?.value) {
            try {
              const parsed: any = JSON.parse(sbCookie.value);
              if (parsed?.access_token) {
                authHeader = `Bearer ${parsed.access_token}`;
              }
            } catch {
              authHeader = `Bearer ${sbCookie.value}`;
            }
          }
        }
      } catch {}
    }

    const base = backendBaseUrl.replace(/\/$/, '');
    const url = `${base}/api/v1/ria/query`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        'x-request-id': requestId,
      },
      body: JSON.stringify(body || {}),
      cache: 'no-store',
    });

    const text = await resp.text();
    try {
      const json = text ? JSON.parse(text) : null;
      return NextResponse.json(json, { status: resp.status });
    } catch {
      return new NextResponse(text, { status: resp.status, headers: { 'Content-Type': resp.headers.get('content-type') || 'text/plain' } });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 });
  }
}

export async function OPTIONS() {
  // Satisfy preflight when clients send JSON POSTs
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
