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

    // Prefer explicit API URL; fallback to the primary custom domain to avoid stale deployments on vercel.app
    const backendApiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'https://ria-hunter.app';
    
    if (!backendApiUrl) {
      console.error('Backend API URL not configured');
      return NextResponse.json({ 
        error: 'Backend API not configured. Please check environment variables.' 
      }, { status: 500 });
    }

    // Primary attempt: call the external Ask service
    const backendResponse = await fetch(`${backendApiUrl}/api/ask`, {
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

          let db = supabase
            .from('advisers')
            .select('cik, legal_name, main_addr_city, main_addr_state, has_private_funds')
            .limit(limit);

          const orClauses: string[] = [];
          // Prioritize full city phrase if we detected one
          if (cityPhrase) {
            orClauses.push(`main_addr_city.ilike.%${cityPhrase}%`);
          }
          // Build OR across legal_name, city, state for each token
          tokens.slice(0, 6).forEach((t) => {
            orClauses.push(`legal_name.ilike.%${t}%`);
            orClauses.push(`main_addr_city.ilike.%${t}%`);
            orClauses.push(`main_addr_state.ilike.%${t}%`);
          });
          if (orClauses.length > 0) {
            // @ts-ignore Postgrest filter string accepted by or()
            db = db.or(orClauses.join(','));
          }

          const { data: advisers, error: dbError } = await db;
          if (dbError) {
            console.error('Fallback DB search error:', dbError);
            return NextResponse.json({ error: 'Search service temporarily unavailable' }, { status: 503 });
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
