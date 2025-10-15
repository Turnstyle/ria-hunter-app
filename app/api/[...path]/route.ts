import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_BACKEND_URL = 'https://ria-hunter.vercel.app';

async function proxyRequest(request: NextRequest) {
  const backendOrigin = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;
  const targetUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, backendOrigin);

  const headers = new Headers(request.headers);
  headers.delete('host');

  const method = request.method.toUpperCase();
  const bodyless = method === 'GET' || method === 'HEAD';
  const body = bodyless ? undefined : await request.text();

  try {
    const response = await fetch(targetUrl.toString(), {
      method,
      headers,
      body,
      redirect: 'manual',
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-length');

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Backend proxy error:', error);
    return NextResponse.json(
      { error: 'Backend request failed' },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request);
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request);
}

export async function OPTIONS(request: NextRequest) {
  return proxyRequest(request);
}
