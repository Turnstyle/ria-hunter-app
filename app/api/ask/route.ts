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

    const backendApiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'https://ria-hunter.vercel.app';
    
    if (!backendApiUrl) {
      console.error('Backend API URL not configured');
      return NextResponse.json({ 
        error: 'Backend API not configured. Please check environment variables.' 
      }, { status: 500 });
    }

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
      let errorMessage = 'Failed to process query';
      try {
        const errorData = await backendResponse.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        errorMessage = `Backend error: ${backendResponse.status} ${backendResponse.statusText}`;
      }
      
      console.error('Backend API error:', errorMessage);
      return NextResponse.json({ 
        error: errorMessage
      }, { status: backendResponse.status });
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
