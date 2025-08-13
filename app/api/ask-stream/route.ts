import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const backendBaseUrl = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL;
  if (!backendBaseUrl) {
    return new Response('Backend URL not configured', { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const authHeader = request.headers.get('authorization') || undefined;

  const base = backendBaseUrl.replace(/\/$/, '');
  const primaryUrl = `${base}/api/ask-stream?query=${encodeURIComponent(query)}`;
  const fallbackUrl = `${base}/api/v1/ria/query-stream?query=${encodeURIComponent(query)}`;

  const headers: Record<string, string> = { 'Accept': 'text/event-stream' };
  if (authHeader) headers['Authorization'] = authHeader;

  const tryFetch = async (url: string) =>
    fetch(url, { method: 'GET', headers, cache: 'no-store' });

  let resp = await tryFetch(primaryUrl);
  if ([404, 405].includes(resp.status)) {
    resp = await tryFetch(fallbackUrl);
  }
  if ([401, 402].includes(resp.status)) {
    delete headers['Authorization'];
    resp = await tryFetch(fallbackUrl);
    if (!resp.ok) resp = await tryFetch(primaryUrl);
  }

  return new Response(resp.body, {
    status: resp.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}
