import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers as nextHeaders } from 'next/headers';
import { createClient } from '@/app/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const reqHeaders = await nextHeaders();
    const requestId = reqHeaders?.get?.('x-request-id') || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Extract user credentials from cookies
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    
    // Check user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      query = '',
      hybrid = true,
      efSearch = 64, // HNSW search parameter
    } = body;
    
    if (!query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }
    
    // Process query - convert to lowercase and trim whitespace
    const processedQuery = query.toLowerCase().trim();
    
    // Set the HNSW ef_search parameter for better recall
    await supabase.rpc('set_hnsw_ef_search', { ef_search: efSearch });
    
    // Execute the search - in a real implementation, we'd call an optimized 
    // search function that performs hybrid search if requested
    const { data, error } = await supabase.rpc('match_narratives', {
      query_embedding: [], // In real implementation, we'd generate an embedding here
      match_threshold: 0.5,
      match_count: 20,
      query_text: processedQuery
    });
    
    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
    
    // For this mock implementation, we'll generate fake results
    // In a real implementation, this would be the actual results from the search
    const mockResults = Array.from({ length: 10 }, (_, i) => ({
      id: `result-${i}`,
      content: `This is a narrative about an RIA firm that ${
        processedQuery.includes('missouri') 
          ? 'is based in Missouri and has significant venture capital investments.'
          : 'specializes in private equity and manages assets for high net worth individuals.'
      } ${
        processedQuery.includes('executive') 
          ? 'The firm is led by experienced executives with backgrounds in finance and investment management.'
          : 'The firm has a strong track record of performance in various market conditions.'
      }`,
      similarity: 0.9 - (i * 0.05),
      metadata: {
        riaId: `ria-${i}`,
        riaName: `RIA Firm ${i + 1}${i < 3 ? ' Capital Partners' : i < 6 ? ' Advisors' : ' Management'}`,
        state: processedQuery.includes('missouri') ? 'MO' : ['NY', 'CA', 'TX', 'IL', 'FL'][i % 5],
        city: processedQuery.includes('missouri') 
          ? ['St. Louis', 'Kansas City', 'Springfield'][i % 3]
          : ['New York', 'San Francisco', 'Chicago', 'Boston', 'Miami'][i % 5],
        aum: (Math.floor(Math.random() * 100) + 1) * 10000000,
      }
    }));
    
    return NextResponse.json({
      results: mockResults,
      query: processedQuery,
      hybrid,
      efSearch,
    });
    
  } catch (error) {
    console.error('RIA search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
