import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { checkUserSubscription } from '@/app/lib/subscription-utils';

const askBodySchema = z.object({
  query: z.string().min(1, { message: "Query cannot be empty" }),
  limit: z.number().optional().default(10),
  aiProvider: z.enum(['openai', 'vertex']).optional().default('openai'),
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = askBodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid request body', 
        issues: validation.error.issues 
      }, { status: 400 });
    }

    const { query, limit, aiProvider } = validation.data;

    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user } } = await supabase.auth.getUser(token);

      if (user) {
        const subscriptionStatus = await checkUserSubscription(user.id);
        if (!subscriptionStatus.hasActiveSubscription) {
          return NextResponse.json({ error: 'Payment Required' }, { status: 402 });
        }
      }
    }

    // Prefer explicit API URL; fallback to our own internal AI search endpoint if external is unavailable
    const backendApiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || '';
    
    if (!backendApiUrl) {
      console.error('Backend API URL not configured');
      return NextResponse.json({ 
        error: 'Backend API not configured. Please check environment variables.' 
      }, { status: 500 });
    }

    let backendResponse: Response;
    if (backendApiUrl) {
      // Primary attempt: call the external Ask service
      backendResponse = await fetch(`${backendApiUrl}/api/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: query.trim(), 
          limit, 
          aiProvider 
        }),
      });
    } else {
      // If no external URL configured, use our internal AI-driven search endpoint directly
      backendResponse = await fetch(`${request.nextUrl.origin}/api/ria-hunter/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
    }

    if (!backendResponse.ok) {
      // If unauthorized or backend unreachable, fall back to a local lightweight search
      if (backendResponse.status === 401 || backendResponse.status === 404 || backendResponse.status === 403 || backendResponse.status === 500) {
        try {
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          const qLower = query.toLowerCase();
          const normalized = qLower.replace(/st\./g, 'st').replace(/[^a-z0-9\s]/g, ' ');
          const tokens = normalized
            .split(/\s+/)
            .filter(Boolean);

          // Detect common city phrases like "st louis"
          let cityPhrase: string | null = null;
          if (/\b(?:st|saint)\s+louis\b/.test(normalized)) {
            cityPhrase = 'st louis';
          }
          // Detect state
          const hasMissouri = /\b(mo|missouri)\b/.test(normalized);
          // Detect private funds intent
          const wantsPrivate = /(private\s*(funds?|placement|equity|invest(ment|ing)))/.test(normalized);

          let db = supabase
            .from('advisers')
            .select('cik, legal_name, main_addr_city, main_addr_state, has_private_funds')
            .limit(limit);

          // City filter (AND)
          if (cityPhrase) {
            db = db.ilike('main_addr_city', `%${cityPhrase}%`);
          }
          // State filter (AND)
          if (hasMissouri) {
            db = db.or('main_addr_state.ilike.%mo%,main_addr_state.ilike.%missouri%');
          }
          // Private funds intent (AND)
          if (wantsPrivate) {
            db = db.eq('has_private_funds', true);
          }

          // Name token matching (OR) to broaden results while keeping city/state filters in place
          const nameClauses: string[] = [];
          tokens.slice(0, 6).forEach((t) => {
            nameClauses.push(`legal_name.ilike.%${t}%`);
          });
          if (nameClauses.length > 0) {
            // @ts-ignore Postgrest filter string accepted by or()
            db = db.or(nameClauses.join(','));
          }

          const { data: advisers, error: dbError } = await db;
          if (dbError) {
            console.error('Fallback DB search error:', dbError);
            // Retry with a simpler, very tolerant query on legal_name only
            const simpleOr = tokens.slice(0, 6).map((t) => `legal_name.ilike.%${t}%`).join(',');
            let simple = supabase
              .from('advisers')
              .select('cik, legal_name, main_addr_city, main_addr_state, has_private_funds')
              .limit(limit);
            if (simpleOr) {
              // @ts-ignore
              simple = simple.or(simpleOr);
            }
            const { data: simpleData, error: simpleErr } = await simple;
            if (simpleErr) {
              console.error('Simple fallback DB search error:', simpleErr);
              return NextResponse.json({ error: 'Search service temporarily unavailable' }, { status: 503 });
            }
            const simpleSources = (simpleData || []).map((a: any) => ({
              firm_name: a.legal_name,
              crd_number: a.cik,
              city: a.main_addr_city,
              state: a.main_addr_state,
            }));
            return NextResponse.json({
              answer: `Found ${simpleSources.length} RIAs matching your query.`,
              sources: simpleSources,
              aiProvider,
              timestamp: new Date().toISOString(),
              query,
            });
          }

          const sources = (advisers || []).map((a: any) => ({
            firm_name: a.legal_name,
            crd_number: a.cik,
            city: a.main_addr_city,
            state: a.main_addr_state,
          }));

          return NextResponse.json({
            answer: `Found ${sources.length} RIAs matching your query.`,
            sources,
            aiProvider,
            timestamp: new Date().toISOString(),
            query,
          });
        } catch (fallbackErr) {
          console.error('Fallback search failed:', fallbackErr);
        }
      }

      let errorMessage = 'Failed to process query';
      try {
        const errorData = await backendResponse.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `Backend error: ${backendResponse.status} ${backendResponse.statusText}`;
      }
      console.error('Backend API error:', errorMessage);
      return NextResponse.json({ error: errorMessage }, { status: backendResponse.status });
    }

    const data = await backendResponse.json();

    if (!data.answer || !Array.isArray(data.sources)) {
      console.error('Unexpected backend response format:', data);
      return NextResponse.json({ 
        error: 'Received unexpected response format from backend'
      }, { status: 500 });
    }

    return NextResponse.json({
      ...data,
      aiProvider,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/ask:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
