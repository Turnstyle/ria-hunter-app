import { NextRequest, NextResponse } from 'next/server';

// Frontend proxy for the backend ask endpoint to avoid browser CORS
export async function POST(request: NextRequest) {
  try {
    const backendBaseUrl = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL;
    if (!backendBaseUrl) {
      // Local-dev fallback: return a mock response so the chat UX is usable without backend
      const { query } = (await request.json().catch(() => ({}))) as { query?: string };
      const mock = {
        answer:
          `Here are a few RIAs matching your query${query ? `: "${query}"` : ''}. I included locations and links to profiles.`,
        sources: [
          {
            crd_number: 123456,
            legal_name: 'Lone Star Capital Advisors, LLC',
            city: 'Austin',
            state: 'TX',
            executives: [
              { name: 'Alex Morgan', title: 'Managing Partner' },
              { name: 'Jamie Taylor', title: 'CIO' },
            ],
            vc_fund_count: 3,
            vc_total_aum: 725_000_000,
            activity_score: 91,
          },
          {
            crd_number: 789012,
            legal_name: 'Capital Ridge Advisors',
            city: 'Austin',
            state: 'TX',
            executives: [{ name: 'Riley Chen', title: 'Founder' }],
            vc_fund_count: 2,
            vc_total_aum: 510_000_000,
            activity_score: 87,
          },
          {
            crd_number: 345678,
            legal_name: 'Barton Springs Ventures',
            city: 'Austin',
            state: 'TX',
            executives: [{ name: 'Jordan Patel', title: 'Partner' }],
            vc_fund_count: 1,
            vc_total_aum: 260_000_000,
            activity_score: 79,
          },
        ],
        metadata: { plan: { mode: 'mock-local-dev' } },
      };
      return NextResponse.json(mock, { status: 200 });
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

    // Fallback A: Only when the primary endpoint is missing/unsupported
    if ([404, 405].includes(resp.status)) {
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

    // Fallback B: Only auth/payment required → try anonymous v1, then anonymous primary
    if ([401, 402].includes(resp.status)) {
      const anonHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      let alt = await fetch(fallbackUrl, {
        method: 'POST',
        headers: anonHeaders,
        body: JSON.stringify(body || {}),
        cache: 'no-store',
      });
      if (!alt.ok) {
        // Fallback C: as a last resort, try anonymous /api/ask
        alt = await fetch(primaryUrl, {
          method: 'POST',
          headers: anonHeaders,
          body: JSON.stringify(body || {}),
          cache: 'no-store',
        });
      }
      resp = alt;
    }

    const text = await resp.text();
    // Normalize response: prefer ApiResponse shape; fallback to mapping `results[]` → sources
    try {
      const raw = text ? JSON.parse(text) : null;

      // If backend already returns the desired shape, pass-through
      if (raw && typeof raw === 'object' && 'answer' in raw && 'sources' in raw) {
        return NextResponse.json(raw, { status: 200 });
      }

      // If backend returns a results array, convert to ApiResponse
      const results = Array.isArray(raw?.results) ? raw.results : Array.isArray(raw?.data) ? raw.data : null;
      if (Array.isArray(results)) {
        const sources = results.slice(0, 10).map((item: any) => ({
          crd_number: Number(item?.crd_number ?? item?.crd ?? item?.crdNumber ?? 0) || 0,
          legal_name: item?.legal_name ?? item?.firm_name ?? item?.name ?? 'Unknown',
          city: item?.city ?? item?.main_addr_city ?? item?.main_office_location?.city ?? '',
          state: item?.state ?? item?.main_addr_state ?? item?.main_office_location?.state ?? '',
          executives: Array.isArray(item?.executives)
            ? item.executives
                .map((e: any) => ({ name: e?.name || e?.person_name || '', title: e?.title ?? null }))
                .filter((e: any) => e.name)
            : [],
          vc_fund_count: Number(item?.private_fund_count ?? 0) || 0,
          vc_total_aum: Number(item?.private_fund_aum ?? item?.total_aum ?? 0) || 0,
          activity_score: Number(item?.activity_score ?? 0) || 0,
        }));

        // Build a concise answer: top 3 firms with city/state and private fund counts by type if present
        const top = sources.slice(0, 3);
        const names = top
          .map((s: any, i: number) => {
            const fn = (t: any) => (typeof t === 'number' && t > 0 ? t : null);
            const vc = fn(results[i]?.vc_count ?? results[i]?.private_fund_vc_count);
            const pe = fn(results[i]?.pe_count ?? results[i]?.private_fund_pe_count);
            const cre = fn(results[i]?.cre_count ?? results[i]?.private_fund_cre_count);
            const parts: string[] = [];
            if (vc) parts.push(`VC ${vc}`);
            if (pe) parts.push(`PE ${pe}`);
            if (cre) parts.push(`CRE ${cre}`);
            const pfBreakdown = parts.length ? ` (${parts.join(', ')})` : '';
            return `${s.legal_name} — ${s.city}, ${s.state}${pfBreakdown}`;
          })
          .join('; ');
        const answer = top.length
          ? `Found ${sources.length} RIAs. Top matches: ${names}. Tap a source to open its profile.`
          : `Found ${sources.length} RIAs. Tap a source to open its profile.`;
        return NextResponse.json({ answer, sources }, { status: 200 });
      }

      // Unknown JSON shape: if OK, pass through; if error, emit diagnostics
      if (resp.ok) {
        return NextResponse.json(raw, { status: resp.status });
      }
      const errorId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      console.error('[ask-proxy:error-json]', {
        errorId,
        backendBaseUrl,
        tried: { primaryUrl, fallbackUrl },
        status: resp.status,
        raw,
      });
      return NextResponse.json(
        { error: 'Upstream ask service failed', errorId, status: resp.status, backend: backendBaseUrl, details: raw },
        { status: 500 }
      );
    } catch {
      // Non-JSON text fallback
      if (resp.ok) {
        return new Response(text, {
          status: resp.status,
          headers: { 'Content-Type': resp.headers.get('content-type') || 'text/plain' },
        });
      }
      const errorId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      console.error('[ask-proxy:error-text]', {
        errorId,
        backendBaseUrl,
        tried: { primaryUrl, fallbackUrl },
        status: resp.status,
        text: text?.slice(0, 1000) ?? null,
      });
      return NextResponse.json(
        { error: 'Upstream ask service failed (text)', errorId, status: resp.status, backend: backendBaseUrl, details: text?.slice(0, 1000) ?? null },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Proxy /api/ask error:', error);
    return NextResponse.json({ error: 'Ask proxy failed' }, { status: 500 });
  }
}
