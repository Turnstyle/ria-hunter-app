import { NextRequest, NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { withAuth } from '@/app/lib/api-wrapper';

export const POST = withAuth(async (request: NextRequest, user: any, supabase: any) => {
  try {
    const reqHeaders = await nextHeaders();
    const requestId = reqHeaders?.get?.('x-request-id') || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      query = '',
      searchResults = [],
    } = body;
    
    if (!query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }
    
    if (!searchResults.length) {
      return NextResponse.json({ error: 'Search results are required for context' }, { status: 400 });
    }
    
    // Generate an answer based on the search results and query
    // In a real implementation, this would call an LLM to generate the answer
    
    // For this mock implementation, we'll generate a simple answer
    const answer = `Based on the search results, ${
      query.toLowerCase().includes('missouri') 
        ? 'there are several RIA firms in Missouri with venture capital investments. '
        : 'there are multiple RIA firms that specialize in private equity and manage assets for high net worth individuals. '
    }${
      query.toLowerCase().includes('executive') 
        ? 'These firms are led by experienced executives with backgrounds in finance and investment management. '
        : 'These firms have strong track records of performance in various market conditions. '
    }The top firms based on your query include ${searchResults.slice(0, 3).map((r: any) => 
      r.metadata?.riaName || 'an unnamed firm'
    ).join(', ')}.`;
    
    // Extract citations from search results
    const citations = searchResults.slice(0, 3).map((r: any) => 
      `${r.metadata?.riaName || 'RIA Firm'} (${r.metadata?.city || ''}, ${r.metadata?.state || ''})`
    );
    
    return NextResponse.json({
      answer,
      citations,
      query,
    });
    
  } catch (error) {
    console.error('RIA answer error:', error);
    return NextResponse.json({ error: 'Failed to generate answer' }, { status: 500 });
  }
});
