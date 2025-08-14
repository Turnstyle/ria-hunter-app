import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || request.headers.get('x-debug-key');
  const configured = process.env.DEBUG_HEALTH_KEY;
  if (configured && key !== configured) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: any = {
    env: {
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
    },
    compute_vc_activity: null,
  };

  try {
    const { data, error } = await supabaseAdmin.rpc('compute_vc_activity', { result_limit: 1, state_filter: 'MO' });
    results.compute_vc_activity = {
      ok: !error,
      error: error?.message || null,
      meta: { returnedRows: Array.isArray(data) ? data.length : null },
    };
  } catch (e: any) {
    results.compute_vc_activity = { ok: false, error: e?.message || String(e) };
  }

  return NextResponse.json({ ok: true, results });
}
