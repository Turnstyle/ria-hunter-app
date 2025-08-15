export type QueryResultItem = {
  name: string;
  city: string;
  state: string;
  aum?: number;
  vcFunds?: number;
  vcAum?: number;
  crdNumbers?: string[];
};

export type QueryResponse = {
  items: QueryResultItem[];
  remaining: number;
  isSubscriber: boolean;
  relaxed: boolean;
  relaxationLevel: 'state' | 'vector-only' | null;
  resolvedRegion?: { city?: string | null; state?: string | null };
};

const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';
const USE_STREAM = false;

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

export async function queryRia(userQuery: string): Promise<QueryResponse> {
  if (USE_STREAM) {
    // Placeholder for future SSE wiring
  }

  if (API_VERSION === 'v1') {
    const res = await fetch('/api/v1/ria/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userQuery }),
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await parseJsonSafe(res);
      const err: any = body || { message: 'Query failed', code: 'QUERY_FAILED' };
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    return {
      items: (data.results || []).map((r: any) => ({
        name: r.legal_name,
        city: r.city,
        state: r.state,
        aum: r.aum,
        vcFunds: r.private_fund_count,
        vcAum: r.private_fund_aum,
        crdNumbers: r.crd_numbers,
      })),
      remaining: data.remaining,
      isSubscriber: !!data.isSubscriber,
      relaxed: !!data.meta?.relaxed,
      relaxationLevel: data.meta?.relaxationLevel ?? null,
      resolvedRegion: data.meta?.resolvedRegion,
    };
  } else {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userQuery }),
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await parseJsonSafe(res);
      const err: any = body || { message: 'Query failed', code: 'QUERY_FAILED' };
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    return {
      items: (data.sources || []).map((r: any) => ({
        name: r.legal_name,
        city: r.city,
        state: r.state,
        aum: r.vc_total_aum ?? r.aum,
        vcFunds: r.vc_fund_count,
        vcAum: r.vc_total_aum,
      })),
      remaining: data.metadata?.remaining ?? 0,
      isSubscriber: data.metadata?.remaining === -1,
      relaxed: !!data.metadata?.relaxed,
      relaxationLevel: data.metadata?.relaxationLevel ?? null,
    };
  }
}

export async function getSubscriptionStatus(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch('/api/subscription-status', { credentials: 'include', headers });
  if (!res.ok) throw await parseJsonSafe(res);
  return res.json();
}

export async function submitNotifyForm(payload: { name: string; email: string; subject: string; message: string }) {
  const res = await fetch('/api/save-form-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseJsonSafe(res);
  return res.json();
}
